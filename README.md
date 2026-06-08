## README

### Repository Components
The repository consists of the following core files:
* `main.html`: The main structural file containing the article's narrative text, layout, and containers for the data visualizations
* `styles.css`: The stylesheet determining how different elements in the project look visually
* `script.js`: The file containing the logic for the project. It handles data fetching, data processing, and the rendering/animation logic for all the D3 charts
* `music_data.csv`: The RIAA dataset containing yearly US music revenue and format data used for the project

### Installation
`script.js` uses the `fetch()` JavaScript function to load the `music_data.csv` file. Because browsers block local file fetching, the project will not work properly if `main.html` is directly opened in a browser. 

To run the project, you must open the directory through a local web server.

### Environment Setup
1. Download the repository to your local machine
2. Open VS Code
3. Install the "Live Server" extension by Ritwick Dey

## Execution
1. In VS Code, open the folder containing the repository
2. Click the "Go Live" button in the bottom right corner to open a local web server
3. The project should run properly
