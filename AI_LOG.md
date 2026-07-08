# AI Collaboration Log

## AI Usage

- Used **Claude** for architecture discussions and code generation.
- Used **Google Gemini** to explore improvements for real-time updates and handling websites protected by bot detection.

## How AI Was Used

- Discussed the assignment requirements and selected the tech stack (Node.js, Express, React, SQLite).
- Generated the initial backend, frontend, Docker configuration, and REST API.
- Helped improve the project by adding:
  - **Socket.io** for real-time updates.
  - **Puppeteer Stealth** for monitoring websites protected by bot detection.

## Key Fixes

- **Frontend API URL:** Updated the frontend to use `http://localhost:4000` instead of the internal Docker hostname (`backend:4000`), since the React app runs in the user's browser.
- **Bot Detection:** Some websites returned `403` for standard HTTP requests. Switched to **Puppeteer Stealth** to perform browser-based health checks for better compatibility.