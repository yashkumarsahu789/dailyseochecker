# Daily SEO Checker – Full Stack (Express.js + React + Vite)

This project is a full-stack SEO dashboard app using:
- **Frontend:** React (Vite, TailwindCSS)
- **Backend:** Express.js (Node.js)

## Local Development

1. **Install dependencies:**
	```bash
	npm install
	```
2. **Start backend server:**
	```bash
	npm run server
	# Runs Express.js backend on http://localhost:3000
	```
3. **Start frontend (in another terminal):**
	```bash
	npm run dev
	# Runs React app on http://localhost:5173 (Vite)
	# API requests to /api/* are proxied to backend
	```

## Production Build & Start

1. **Build frontend:**
	```bash
	npm run build
	```
2. **Start full-stack app:**
	```bash
	npm start
	# Serves built frontend and Express.js API from the same server
	```

## Environment Variables

- `.env` file (for frontend):
  - `VITE_API_URL` should be set to your deployed backend URL (e.g. Railway, Render, etc.)

## Deployment

You can deploy this app on Railway, Render, or any Node.js-compatible host. Just make sure to set environment variables and use `npm run build` + `npm start` for production.

---
**All API endpoints are handled by Express.js backend.**
Frontend and backend are fully decoupled and ready for deployment from this repository.
