# Expense & Budget Visualizer

A responsive client-side expense tracker built with HTML, CSS, and Vanilla JavaScript.

## Features
- Add transactions with item name, amount, and category
- Required-field and positive-amount validation
- Transaction list with delete and search
- Automatically updated total balance and transaction count
- Pie chart for spending by category
- Local Storage persistence
- Custom categories
- Monthly spending summary (click the "THIS MONTH" card value/caption)
- Dark/light mode

## Project structure
```text
expense-budget-visualizer/
├── .kiro/
│   └── README.md
├── css/
│   └── style.css
├── js/
│   └── script.js
├── index.html
└── README.md
```

## Run locally
Open `index.html` in a modern browser. For a smoother development workflow, use VS Code Live Server or Live Preview.

Chart.js is loaded from a CDN, so an internet connection is required for the pie chart. Transaction data and theme preference are stored in the browser's Local Storage.

## GitHub Pages
1. Create a GitHub repository using the required CodingCamp naming format.
2. Upload the project files and folders, including `.kiro`.
3. In repository settings, open **Pages**.
4. Select the deployment branch (usually `main`) and root folder (`/`).
5. Save and wait for the published website URL.
