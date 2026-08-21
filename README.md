---

# 🏋️‍♂️ FormFit – AI Fitness Trainer

FormFit is a full-stack AI-powered fitness application that generates personalized workout plans, analyzes exercise form in real time, and provides a modern dashboard for user fitness tracking.

---

## 🚀 Features

* 🤖 AI-generated workout plans (Gemini API)
* 🎥 Real-time exercise form feedback using MediaPipe
* 🔌 WebSocket-based live tracking
* 🔐 Secure JWT authentication
* 📊 Dashboard with charts and fitness analytics
* 🎨 Responsive UI built with Tailwind CSS

---

## 🧰 Tech Stack

* **React** – UI components and frontend logic
* **JavaScript (ES6+)** – Primary language
* **Node.js** – Backend runtime
* **Express.js** – Server framework
* **MongoDB + Mongoose** – Database & modeling
* **MediaPipe** – Real-time pose detection
* **OpenCV.js** – Video/image processing
* **Chart.js** – Visual analytics
* **Socket.IO** – Real-time communication

---

## 🛠️ Installation

Clone the repo:

```bash
git clone https://github.com/Nandishreddy2903/FormFit.git
cd FormFit
```

---

# ⚙️ Backend Setup (`apps/api`)

```bash
cd apps/api
npm install
```

Create a `.env` file:

```
MONGO_URI=mongodb://localhost:27017/formfit
JWT_SECRET=your_secret_key
PORT=4000
```

Start backend:

```bash
npm start
```

Backend URL: `http://localhost:4000`

---

# 🌐 Frontend Setup (`apps/web`)

```bash
cd apps/web
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Start frontend:

```bash
npm run dev
```

Frontend URL: `http://localhost:3000`

---

## 📂 Project Structure

```
FormFit/
 └── apps/
      ├── api/
      │    ├── src/
      │    ├── models/
      │    ├── websocket/
      │    ├── utils/
      │    ├── app.js
      │    └── index.js
      └── web/
           ├── app/
           ├── components/
           ├── hooks/
           ├── lib/
           └── styles/
```