export const dynamic = 'force-dynamic';

function extractDriveId(url) {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get('url');
    const directId = searchParams.get('id');
    const fileId = directId || extractDriveId(rawUrl);

    if (!fileId) {
      return new Response(JSON.stringify({ error: 'Missing Google Drive file id or url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const driveUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;
    const clientRange = request.headers.get('range');

    const fetchHeaders = {};
    if (clientRange) {
      fetchHeaders['Range'] = clientRange;
    }

    const driveRes = await fetch(driveUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
    });

    if (!driveRes.ok && driveRes.status !== 206) {
      return new Response(JSON.stringify({ error: 'Failed to fetch video from Google Drive' }), {
        status: driveRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', driveRes.headers.get('content-type') || 'video/mp4');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Content-Disposition', 'inline');
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    const contentRange = driveRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }
    const contentLength = driveRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    return new Response(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Video proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
