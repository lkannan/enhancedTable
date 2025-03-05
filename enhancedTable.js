(function () {
    // Utility function to parse the metadata into arrays
    function parseMetadata(metadata) {
        const { dimensions: dimensionsMap, mainStructureMembers: measuresMap } = metadata;
        const dimensions = [];
        for (const key in dimensionsMap) {
            const dimension = dimensionsMap[key];
            dimensions.push({ key, ...dimension });
        }
        const measures = [];
        for (const key in measuresMap) {
            const measure = measuresMap[key];
            measures.push({ key, ...measure });
        }
        return { dimensions, measures, dimensionsMap, measuresMap };
    }

    const template = document.createElement('template');
    template.innerHTML = `
        <style>
            .table-container {
                width: 100%;
                height: 100%;
                overflow: auto;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                font-family: Arial, sans-serif;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f4f4f4;
                font-weight: bold;
            }
            tr:nth-child(even) {
                background-color: #f9f9f9;
            }
        </style>
        <div class="table-container">
            <table id="dataTable">
                <thead id="tableHeader"></thead>
                <tbody id="tableBody"></tbody>
            </table>
        </div>
    `;

    class EnhancedTable extends HTMLElement {
        constructor() {
            super();
            this._shadowRoot = this.attachShadow({ mode: 'open' });
            this._shadowRoot.appendChild(template.content.cloneNode(true));
            this._props = {};
        }

        onCustomWidgetResize(width, height) {
            this.render();
        }

        onCustomWidgetAfterUpdate(changedProps) {
            this.render();
        }

        /**
         * Calls the Google Gemini API to perform sentiment analysis.
         * Expects the 'apiKey' property to be set.
         */
        async fetchSentiment(reviewText, apiKey) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            // Correct payload structure for Gemini API
            const payload = {
                contents: [{
                    parts: [{
                        text: `Analyze the sentiment of this review and respond with either 'Positive',
                              'Negative', or 'Neutral': "${reviewText}"`
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    topK: 1,
                    topP: 0.8,
                    maxOutputTokens: 20
                }
            };
        
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                // Parse the Gemini API response correctly
                if (result && 
                    result.candidates && 
                    result.candidates.length > 0 && 
                    result.candidates[0].content && 
                    result.candidates[0].content.parts && 
                    result.candidates[0].content.parts.length > 0) {
                    return result.candidates[0].content.parts[0].text;
                } else {
                    return "No sentiment result";
                }
            } catch (err) {
                console.error("Sentiment analysis error:", err);
                return "Error analyzing sentiment";
            }
        }

        async render() {
            const dataBinding = this.dataBinding;
            if (!dataBinding || dataBinding.state !== 'success') {
                return;
            }

            const { data, metadata } = dataBinding;
            const { dimensions, measures } = parseMetadata(metadata);
            
            // Ensure at least one dimension and one measure exist.
            if (dimensions.length === 0 || measures.length === 0) {
                return;
            }
            
            // Use the first dimension (assumed to be the review text) and measure.
            const reviewDimension = dimensions[0];
            const measure = measures[0];
            const apiKey = this.apiKey || "";

            const tableHeader = this._shadowRoot.getElementById('tableHeader');
            const tableBody = this._shadowRoot.getElementById('tableBody');

            // Build the header row with three columns: Review, Measure, and Sentiment Analysis.
            tableHeader.innerHTML = `<tr>
                <th>${reviewDimension.description}</th>
                <th>${measure.description}</th>
                <th>Sentiment Analysis</th>
            </tr>`;

            // Clear any existing rows in the body.
            tableBody.innerHTML = "";

            // Process each row of data.
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const reviewText = row[reviewDimension.key].label;
                const measureValue = row[measure.key].formatted;

                // Create a new row.
                const tr = document.createElement('tr');

                // Review text cell.
                const reviewCell = document.createElement('td');
                reviewCell.innerText = reviewText;
                tr.appendChild(reviewCell);

                // Measure cell.
                const measureCell = document.createElement('td');
                measureCell.innerText = measureValue;
                tr.appendChild(measureCell);

                // Sentiment Analysis cell.
                const sentimentCell = document.createElement('td');
                sentimentCell.innerText = "Loading...";
                tr.appendChild(sentimentCell);

                tableBody.appendChild(tr);

                // If an API key has been provided, call the Gemini API.
                if (apiKey) {
                    this.fetchSentiment(reviewText, apiKey).then(sentiment => {
                        sentimentCell.innerText = sentiment;
                    });
                } else {
                    sentimentCell.innerText = "API key missing";
                }
            }
        }

        // Getter and setter for the apiKey property.
        get apiKey() {
            return this._props.apiKey || this.getAttribute("apiKey");
        }

        set apiKey(value) {
            this._props.apiKey = value;
        }
    }

    // Define the custom element.
    customElements.define('com-sap-sample-enhanced_table', EnhancedTable);
})();

