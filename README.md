## README

### Repository Components
The repository consists four core files which handle the scructural, visual, logical, and data componets of the project. The main structural file is `main.html`, which contains the article's narrative text, layout, and containers for the data visualizations. The styling for these elements is handled by `styles.css`. The logic of the project is contained entirely within `script.js`. This file handles the data fetching, data processing, and the rendering/animation logic for all the D3.js charts. Finally, `music_data.csv` is the RIAA dataset containing yearly US music revenue and format data used for the project.

### Installation
The dataset used for the project is only 69 KB and is included in the repository.

`script.js` uses the `fetch()` JavaScript function to load the `music_data.csv` file. Because browsers block local file fetching, the project will not work properly if `main.html` is directly opened in a browser. 

To run the project, you must open the directory through a local web server.


### Environment Setup
1. Download the repository to your local machine
2. Open VS Code
3. Install the "Live Server" extension by Ritwick Dey

## Execution
1. In VS Code, open the folder containing the repository
2. Click the "Go Live" button in the bottom right corner to open a local web server
3. Ensure that there is an internet connection as the project loads an image from the internet for the background

Data is processed within `script.js` and there are no preprocessing scripts.
