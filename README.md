# Expense Tracker

A simple, fast expense tracker that runs entirely in the browser. Add income and expenses, filter and search them, and see your balance update instantly. Built with plain HTML, CSS and vanilla JavaScript, with [Vite](https://vitejs.dev/) as the dev server and build tool. No framework, no backend, no account needed.

## Features

- Add, edit and delete transactions (income or expense)
- Live summary: current balance, total income, total expenses
- Filter by type (All / Income / Expense) and by category
- Form validation for amount, date and category
- Compatible with mobile view
- Data is saved automatically in your browser 

## Tech Stack

- HTML5, CSS3, vanilla JavaScript (ES6+)
- [Vite](https://vitejs.dev/) 5 for development and production builds

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **18 or newer** (includes `npm`)
- [Git](https://git-scm.com/)

Check your versions:

```bash
node -v
npm -v
git --version
```

### Setup on a new machine

```bash
# 1. Clone the repository
git clone https://github.com/YOUR-USERNAME/expense-tracker.git

# 2. Move into the project folder
cd expense-tracker

# 3. Install dependencies
npm install

# 4. Start the dev server
npm run dev
```

Then open **http://localhost:8000** in your browser or you can add your own port number using --port xxxx

## Run on Your Phone (hosted from your PC)

You can open the app on your mobile while it runs on your computer. This is handy for testing the mobile layout.

**1. Connect both devices to the same Wi-Fi network.**

**2. Start the dev server with network access enabled:**

```bash
npm run dev -- --host
```

Vite will print something like:

```
  ➜  Local:   http://localhost:8000/
  ➜  Network: http://192.168.1.25:8000/
```

**3. Open the `Network` URL on your phone's browser** (for example `http://192.168.1.25:8000`).

If no `Network` line is shown, find your PC's local IP address manually:

| OS            | Command                                  |
| ------------- | ---------------------------------------- |
| Windows       | `ipconfig` (look for **IPv4 Address**)   |
| macOS         | `ipconfig getifaddr en0`                 |
| Linux         | `hostname -I`                            |

Then open `http://<your-ip>:5173` on your phone.

**Not loading on your phone?**

- Make sure both devices are on the **same Wi-Fi** (not guest Wi-Fi or mobile data).
- Allow Node.js through your PC firewall when prompted (on Windows, choose **Private networks**), or allow inbound traffic on port `5173`.
- Some public or office networks block device-to-device connections. Try a home network or your phone's hotspot with the PC connected to it.
- Use `http://`, not `https://`.

> Your transactions are stored in each browser's `localStorage`, so the phone starts with its own empty list and does not share data with the PC.

To test a production build the same way, run `npm run build` followed by `npm run preview -- --host`.

## Project Structure

```
expense-tracker/
├── index.html         # Page markup (header, summary cards, filters, modals)
├── style.css          # All styling
├── app.js             # App logic: state, CRUD, filters, localStorage
├── package.json       # Scripts and dependencies
└── package-lock.json  # Locked dependency versions
```

## How Your Data Is Stored

All transactions are stored in your browser's `localStorage` on your own device. Nothing is sent to a server.

- Data is **per browser and per device**. Opening the app in another browser or on another machine starts with an empty list.
- Clearing your browser's site data will erase your transactions.

## Deployment

The app is a static site, so it can be hosted anywhere that serves static files (GitHub Pages, Netlify, Vercel, etc.).

```bash
npm run build
```

Upload or deploy the generated `dist/` folder.

**GitHub Pages note:** if you host at `https://YOUR-USERNAME.github.io/expense-tracker/`, add a `vite.config.js` in the project root before building:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/expense-tracker/', // use your repo name
});
```

## Troubleshooting

- **`npm: command not found`**: install Node.js from [nodejs.org](https://nodejs.org/) and reopen your terminal.
- **`Port 5173 is already in use`**: close the other process using that port, or change the port in the `dev` script in `package.json`.
- **Blank page or missing styles after deploying**: check that the `base` option in `vite.config.js` matches your repo name.
- **Transactions disappeared**: they live in browser `localStorage`, so they will not carry over between browsers, devices or after clearing site data.



