# README

## Description
This project is an interactive narrative visualization that explores the 50-year evolution of the United States music industry (1973–2025). Using inflation-adjusted revenue data from the RIAA, the application guides users through the rise and fall of major music formats—from vinyl and cassettes to CDs, digital downloads, and modern streaming platforms. The project utilizes a "Martini Glass" narrative structure, concluding with an interactive dashboard that allows users to independently explore the dataset using coordinated multiple views (CMV).

### Repository Components
The repository consists of the following core files:
* `main.html`: The structural entry point of the application. It contains the article's narrative text, semantic HTML layout, and container `div`s for the data visualizations. It imports D3.js (v7) via a CDN.
* `styles.css`: The stylesheet governing the visual presentation, responsive layout, and interactive UI states (buttons, tooltips, and format-selection chips).
* `script.js`: The main application logic. It handles asynchronous data fetching, dynamic data preprocessing, scroll-triggered DOM updates via `IntersectionObserver`, and the rendering/animation logic for all eight D3.js charts.
* `music_data.csv`: The primary RIAA dataset containing yearly U.S. music revenue and format data.

## Installation
Because this project utilizes vanilla JavaScript and imports D3.js via a CDN, there are no complex environment setups, `npm install` commands, or dependencies to manage. 

However, because `script.js` uses the native `fetch()` API to load the `music_data.csv` file dynamically, **you cannot simply double-click `main.html` to open it in a browser.** Browsers block local file fetching due to strict CORS (Cross-Origin Resource Sharing) security policies. 

To run the project, you must serve the directory through a local web server.

### Environment Setup
1. Clone or download this repository to your local machine.
2. Ensure you have a way to run a local web server. Two of the easiest methods are:
   * **Python (Pre-installed on macOS/Linux):** You can use Python's built-in HTTP server.
   * **VS Code Live Server:** If using Visual Studio Code, install the "Live Server" extension by Ritwick Dey.

## Execution
### 1. Data Preprocessing
*Note for Graders:* There are no separate data preprocessing scripts (e.g., Python or Node.js scripts) to execute. To ensure a seamless execution experience, all data preprocessing is handled dynamically in the client's browser. The `load_story_data()` function in `script.js` reads the raw `music_data.csv`, filters out pre-calculated totals, categorizes micro-formats into overarching narrative groups (e.g., merging "LP/EP" into "Vinyl"), converts string currencies to floating-point billions, and structures the data into a wide format suitable for D3 stack generators.

### 2. Running the Frontend Application
If using **Python**:
1. Open your terminal or command prompt.
2. Navigate to the root directory of this repository (where `main.html` is located).
3. Run the following command:
   ```bash
   python -m http.server 8000
   # (If using Python 2, use: python -m SimpleHTTPServer 8000)
