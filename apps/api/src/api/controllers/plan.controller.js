import https from "https";
import Plan from "../../models/Plan.model.js";
import Exercise  from "../../models/Exercise.model.js";

function buildPrompt(user, extra = {}) {
  const goals = (user?.fitnessGoals || []).join(', ');
  const age = user?.age ? `${user.age}` : 'unknown';
  const height = user?.height ? `${user.height} cm` : 'unknown';
  const weight = user?.weight ? `${user.weight} kg` : 'unknown';
  const dietaryPref=user?.dieteryPref || user?.dietaryPref || 'nonveg';
  const allowedExercises = Array.isArray(extra.allowedExercises) && extra.allowedExercises.length
    ? extra.allowedExercises
    : [];
  // Add randomness to ensure different plans on regeneration
  const seed = extra.randomSeed || Date.now();
  const header = `Create a 7-day workout and diet plan personalized to the following user profile. Return STRICT JSON only, matching the schema.
Make this plan unique by incorporating variety in exercises and approaches. Random seed: ${seed}

User Profile:
- Name: ${user?.name || 'User'}
- Age: ${age}
- Height: ${height}
- Weight: ${weight}
- Goals: ${goals || 'general fitness'}
- Dietary Pref: ${dietaryPref} 

Requirements:
- Provide weeklyPlan: array of 7 days with day, focus, items (array of exercises), and optional sets/reps or duration per item.
- IMPORTANT: For weeklyPlan.items, you MUST choose exercise names ONLY from the Allowed Exercises list below, EXACTLY as written (case and punctuation must match). Do not invent, pluralize, or use synonyms.
- Provide diet: macros (per kg bodyweight: protein, carbs, fats), guidance note, and sampleMeals (breakfast, lunch, snack, dinner strings).All meals MUST strictly follow the user's Dietary Preference (${dietaryPref}).
- Provide calories: maintainLow, maintainHigh (daily kcal), and delta (e.g., -400 for fat loss or +250 for muscle).
- Keep exercises bodyweight or light equipment by default.
- Keep language concise.

Allowed Exercises:
${allowedExercises.length ? allowedExercises.map((n) => `- ${n}`).join('\n') : '- (none provided)'}

JSON Schema:
{
  "overview": "string",
  "weeklyPlan": [
    { "day": "Mon", "focus": "string", "items": ["string"], "sets": "string", "reps": "string", "duration": "string" }
  ],
  "diet": {
    "macros": { "protein": "number", "carbs": "number", "fats": "number" },
    "note": "string",
    "sampleMeals": { "breakfast": "string", "lunch": "string", "snack": "string", "dinner": "string" }
  },
  "calories": { "maintainLow": "number", "maintainHigh": "number", "delta": "number" }
}`;
  return header;
}

function isModelFallbackError(error) {
  const message = String(error?.message || '').toLowerCase();
  return [429, 503].includes(error?.statusCode) ||
    ['RESOURCE_EXHAUSTED', 'UNAVAILABLE'].includes(error?.apiStatus) ||
    /high demand|overload|rate.?limit|quota|temporarily unavailable|not found|not supported|no longer available|not available to new users|deprecated|retired/.test(message);
}

async function geminiRequest({ path, method = 'GET', body }) {
  const response = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

  let parsed;
  try {
    parsed = JSON.parse(response.data);
  } catch {
    const error = new Error(`Invalid JSON response from provider: ${response.data.substring(0, 200)}`);
    error.statusCode = response.statusCode;
    throw error;
  }

  if (parsed.error || response.statusCode >= 400) {
    const error = new Error(parsed.error?.message || `Gemini API returned HTTP ${response.statusCode}`);
    error.statusCode = response.statusCode;
    error.apiStatus = parsed.error?.status;
    throw error;
  }

  return parsed;
}

async function listGeminiModels(apiKey) {
  const models = [];
  let pageToken;

  do {
    const query = new URLSearchParams({ key: apiKey, pageSize: '1000' });
    if (pageToken) query.set('pageToken', pageToken);
    const result = await geminiRequest({ path: `/v1beta/models?${query}` });
    models.push(...(result.models || []));
    pageToken = result.nextPageToken;
  } while (pageToken);

  return models;
}

async function callGemini({ apiKey, model = 'gemini-3.8-flash', prompt }) {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }]}],
  });
  const generateWithModel = async (modelId) => {
    console.log('Making Gemini API call with model:', modelId);
    const parsed = await geminiRequest({
      path: `/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      method: 'POST',
      body,
    });
    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text.trim()) throw new Error('Provider returned empty response');
    return { raw: parsed, text, model: modelId };
  };

  const preferredModel = String(model || 'gemini-3.8-flash').replace(/^models\//, '');
  try {
    return await generateWithModel(preferredModel);
  } catch (primaryError) {
    if (!isModelFallbackError(primaryError)) throw primaryError;
    console.warn(`Gemini model ${preferredModel} unavailable; looking for a fallback model.`);

    let availableModels;
    try {
      availableModels = await listGeminiModels(apiKey);
    } catch (listError) {
      console.warn('Could not list Gemini models:', listError.message);
      throw primaryError;
    }

    const fallbackModels = [...new Set(availableModels
      .filter((item) => item.supportedGenerationMethods?.includes('generateContent'))
      .map((item) => item.baseModelId || item.name?.replace(/^models\//, ''))
      .filter((modelId) => modelId && modelId !== preferredModel && !/^gemini-(?:1\.\d+|2\.5)-/i.test(modelId)))]
      .sort((a, b) => Number(/flash/i.test(b)) - Number(/flash/i.test(a)))
      .slice(0, 3);

    let lastError = primaryError;
    for (const fallbackModel of fallbackModels) {
      try {
        return await generateWithModel(fallbackModel);
      } catch (error) {
        lastError = error;
        if (!isModelFallbackError(error)) throw error;
        console.warn(`Gemini fallback model ${fallbackModel} failed:`, error.message);
      }
    }

    throw lastError;
  }
}

function tryExtractJson(text) {
  if (!text || typeof text !== 'string') return null;
  // Try fenced code block first
  const m = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  let str = m ? m[1] : text;
  // Attempt to locate the first JSON object
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  str = str.slice(start, end + 1);
  try { return JSON.parse(str); } catch { return null; }
}

// POST /api/v1/plans/generate  { apiKey, provider?, model?, save? }
const generatePlan = async (req, res) => {
  try {
    const user = req.user;
    const { apiKey, provider = 'google', model = 'gemini-3.8-flash', save = false } = req.body || {};
    if (!apiKey) return res.status(400).json({ message: 'Missing apiKey (BYOK)' });
    if (provider !== 'google') return res.status(400).json({ message: 'Only provider "google" (Gemini) is supported for now' });

    // Fetch allowed exercise names from DB (canonical list)
    const allExercises = await Exercise.find({}, 'name').sort({ name: 1 }).lean();
    const allowedNames = allExercises.map((e) => e.name);

    const randomSeed = Date.now() + Math.random();
    const prompt = buildPrompt(user, { allowedExercises: allowedNames, randomSeed });
    const { text, model: usedModel } = await callGemini({ apiKey, model, prompt });
    let planObject = tryExtractJson(text);

    // Post-process planObject to strictly use allowed exercise names
    if (planObject && Array.isArray(planObject.weeklyPlan)) {
      const normMap = new Map();
      const toKey = (s) => String(s || '').trim().toLowerCase()
        .replace(/\([^)]*\)/g, '') // remove parenthetical
        .replace(/[^a-z0-9]+/g, ' ') // collapse punctuation
        .replace(/\s+/g, ' ') // trim spaces
        .trim();
      for (const name of allowedNames) normMap.set(toKey(name), name);

      function bestMatch(raw) {
        const k = toKey(raw);
        if (normMap.has(k)) return normMap.get(k);
        // Try naive singularization for common plurals
        const singular = k.endsWith('s') ? k.slice(0, -1) : k;
        if (normMap.has(singular)) return normMap.get(singular);
        // Common manual mappings (plural -> singular)
        const manual = new Map([
          ['push ups', 'Push-up'],
          ['pushup', 'Push-up'],
          ['pushups', 'Push-up'],
          ['push up', 'Push-up'],
          ['squat', 'Squat'],
          ['squats', 'Squat'],
          ['lunge', 'Lunge'],
          ['lunges', 'Lunge'],
          ['bicep curl', 'Bicep Curl'],
          ['bicep curls', 'Bicep Curl'],
          ['tricep dip', 'Tricep Dip'],
          ['tricep dips', 'Tricep Dip'],
          ['mountain climber', 'Mountain Climber'],
          ['mountain climbers', 'Mountain Climber'],
          ['jumping jack', 'Jumping Jack'],
          ['jumping jacks', 'Jumping Jack'],
          ['shoulder press', 'Shoulder Press'],
          ['incline push ups', 'Push-up'],
          ['incline pushup', 'Push-up'],
          ['incline push-ups', 'Push-up'],
          ['dumbbell rows', 'Push-up'],
          ['overhead press', 'Shoulder Press'],
          ['glute bridges', 'Squat'],
          ['calf raises', 'Squat'],
          ['burpees', 'Jumping Jack'],
          ['plank', 'Push-up'],
          ['brisk walking', 'Jumping Jack'],
          ['yoga', 'Push-up'],
          ['stretching', 'Push-up'],
          ['cycling', 'Jumping Jack'],
          ['swimming', 'Jumping Jack'],
          ['walking', 'Jumping Jack'],
        ]);
        if (manual.has(k)) return manual.get(k);
        if (manual.has(singular)) return manual.get(singular);
        return null;
      }

      planObject.weeklyPlan = planObject.weeklyPlan.map((day) => {
        const items = Array.isArray(day.items) ? day.items : [];
        const mapped = items
          .map((it) => bestMatch(it))
          .filter((x) => !!x);
        // If nothing matched, provide a small default from allowed list to avoid empty days
        const safeItems = mapped.length ? mapped : allowedNames.slice(0, Math.min(4, allowedNames.length));
        return { ...day, items: Array.from(new Set(safeItems)) };
      });
    }

    let saved = null;
    if (save) {
      const doc = new Plan({ user: user._id, provider, model: usedModel, promptVersion: 'v1', planObject: planObject || undefined, planText: planObject ? undefined : text });
      saved = await doc.save();
    }

    return res.status(200).json({
      provider,
      model: usedModel,
      planObject,
      planText: planObject ? undefined : text,
      savedId: saved?._id,
    });
  } catch (e) {
    console.error('Generate Plan Error:', e.message);
    return res.status(500).json({ message: 'Failed to generate plan', error: e.message });
  }
};

// POST /api/v1/plans/save  { planObject?, planText? }
const savePlan = async (req, res) => {
  try {
    const user = req.user;
    let { planObject, planText, provider = 'google', model = 'gemini-3.8-flash' } = req.body || {};
    if (!planObject && (!planText || planText.trim() === '')) return res.status(400).json({ message: 'Missing planObject or planText' });
    // If planObject present, sanitize items against DB exercise names
    if (planObject && Array.isArray(planObject.weeklyPlan)) {
      const allExercises = await Exercise.find({}, 'name').sort({ name: 1 }).lean();
      const allowedNames = allExercises.map((e) => e.name);
      const toKey = (s) => String(s || '').trim().toLowerCase()
        .replace(/\([^)]*\)/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const normMap = new Map();
      for (const name of allowedNames) normMap.set(toKey(name), name);
      const manual = new Map([
        ['push ups', 'Push-up'],
        ['pushup', 'Push-up'],
        ['pushups', 'Push-up'],
        ['push up', 'Push-up'],
        ['squat', 'Squat'],
        ['squats', 'Squat'],
        ['lunge', 'Lunge'],
        ['lunges', 'Lunge'],
        ['bicep curl', 'Bicep Curl'],
        ['bicep curls', 'Bicep Curl'],
        ['tricep dip', 'Tricep Dip'],
        ['tricep dips', 'Tricep Dip'],
        ['mountain climber', 'Mountain Climber'],
        ['mountain climbers', 'Mountain Climber'],
        ['jumping jack', 'Jumping Jack'],
        ['jumping jacks', 'Jumping Jack'],
        ['shoulder press', 'Shoulder Press'],
        ['incline push ups', 'Push-up'],
        ['incline pushup', 'Push-up'],
        ['incline push-ups', 'Push-up'],
        ['dumbbell rows', 'Push-up'],
        ['overhead press', 'Shoulder Press'],
        ['glute bridges', 'Squat'],
        ['calf raises', 'Squat'],
        ['burpees', 'Jumping Jack'],
        ['plank', 'Push-up'],
        ['brisk walking', 'Jumping Jack'],
        ['yoga', 'Push-up'],
        ['stretching', 'Push-up'],
        ['cycling', 'Jumping Jack'],
        ['swimming', 'Jumping Jack'],
        ['walking', 'Jumping Jack'],
      ]);
      const best = (raw) => {
        const k = toKey(raw);
        if (normMap.has(k)) return normMap.get(k);
        const singular = k.endsWith('s') ? k.slice(0, -1) : k;
        if (normMap.has(singular)) return normMap.get(singular);
        if (manual.has(k)) return manual.get(k);
        if (manual.has(singular)) return manual.get(singular);
        return null;
      };
      planObject.weeklyPlan = planObject.weeklyPlan.map((day) => {
        const items = Array.isArray(day.items) ? day.items : [];
        const mapped = items.map(best).filter(Boolean);
        const safeItems = mapped.length ? mapped : allowedNames.slice(0, Math.min(4, allowedNames.length));
        return { ...day, items: Array.from(new Set(safeItems)) };
      });
    }
    const doc = new Plan({ user: user._id, provider, model, promptVersion: 'v1', planObject, planText });
    await doc.save();
    return res.status(201).json({ message: 'Plan saved', id: doc._id });
  } catch (e) {
    console.error('Save Plan Error:', e.message);
    return res.status(500).json({ message: 'Failed to save plan' });
  }
};

// GET /api/v1/plans/latest
const getLatestPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const plan = await Plan.findOne({ user: userId }).sort({ createdAt: -1 });
    if (!plan) return res.status(200).json({ plan: null });
    return res.status(200).json({ plan });
  } catch (e) {
    console.error('Get Latest Plan Error:', e.message);
    return res.status(500).json({ message: 'Failed to fetch latest plan' });
  }
};

export {generatePlan,savePlan,getLatestPlan};