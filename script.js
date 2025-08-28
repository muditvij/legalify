
 const API_KEY = "AIzaSyDgHqrrTXR8apwWUxJSomJgw-BODNFoC-E"; // The execution environment will provide the key.
        const MODEL = "gemini-1.5-flash";
        let originalDocumentText = '';
        let chatHistory = [];

        /**
         * Shows the startup loader for a few seconds on page load.
         */
        window.addEventListener('load', () => {
            const loader = document.getElementById('startup-loader');
            setTimeout(() => {
                loader.classList.add('hidden');
            }, 2500);
        });

        /**
         * Toggles between the text input and PDF upload tabs.
         * @param {string} tabName - The name of the tab to show ('text' or 'pdf').
         */
        function showTab(tabName) {
            document.getElementById('textInputArea').classList.toggle('hidden', tabName !== 'text');
            document.getElementById('pdfInputArea').classList.toggle('hidden', tabName !== 'pdf');
            document.getElementById('textTab').classList.toggle('text-blue-600', tabName === 'text');
            document.getElementById('textTab').classList.toggle('border-blue-600', tabName === 'text');
            document.getElementById('pdfTab').classList.toggle('text-blue-600', tabName === 'pdf');
            document.getElementById('pdfTab').classList.toggle('border-blue-600', tabName === 'pdf');
        }

        /**
         * Clears all input fields and resets the output areas.
         */
        function clearInputs() {
            document.getElementById('userInput').value = '';
            document.getElementById('pdfInput').value = '';
            document.getElementById('pdfFileName').textContent = 'Click to upload a PDF file';
            document.getElementById('responseBox').innerHTML = 'Your simplified summary will appear here.';
            document.getElementById('actionButtons').classList.add('hidden');
            document.getElementById('chatSection').classList.add('hidden');
            originalDocumentText = '';
            chatHistory = [];
        }

        /**
         * Handles the PDF file upload, extracts text, and places it in the textarea.
         * @param {Event} event - The file input change event.
         */
        async function handlePdfUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            document.getElementById('pdfFileName').textContent = file.name;
            const loader = document.getElementById('loader');
            loader.classList.remove('hidden');
            loader.querySelector('p').textContent = 'Extracting text from PDF...';
            
            try {
                const reader = new FileReader();
                reader.onload = async function(e) {
                    const typedarray = new Uint8Array(e.target.result);
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let textContent = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const text = await page.getTextContent();
                        textContent += text.items.map(s => s.str).join(' ') + '\n';
                    }
                    document.getElementById('userInput').value = textContent;
                    loader.classList.add('hidden');
                    loader.querySelector('p').textContent = 'Analyzing your document...';
                };
                reader.readAsArrayBuffer(file);
            } catch (error) {
                console.error("PDF processing error:", error);
                showMessage("Error processing PDF. Please ensure it's a valid file.");
                loader.classList.add('hidden');
            }
        }

        /**
         * Sends a prompt to the Gemini API and returns the response.
         * @param {string} prompt - The prompt to send to the model.
         * @param {boolean} showLoading - Whether to show the main loader.
         * @returns {Promise<string>} The text response from the model.
         */
        async function callGemini(prompt, showLoading = true) {
            if (showLoading) {
                document.getElementById('loader').classList.remove('hidden');
            }

            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
                }

                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) throw new Error("No valid response from the model.");
                return text;
            } catch (err) {
                console.error("Gemini API Error:", err);
                return `❌ **Error:** Could not get a response. Please try again later. (${err.message})`;
            } finally {
                 if (showLoading) {
                    document.getElementById('loader').classList.add('hidden');
                }
            }
        }

        /**
         * Main function to start the document simplification process.
         */
        async function simplifyDocument() {
            originalDocumentText = document.getElementById("userInput").value.trim();
            if (originalDocumentText.length < 10) { 
                showMessage("The provided text is too short. Please input a valid legal document.");
                return;
            }
            
            const prompt = `
                You are an expert legal analyst specializing in Indian law, tasked with simplifying complex legal documents for a layperson. Your tone should be clear, reassuring, and professional, like a helpful legal consultant.
                
                Analyze the following document thoroughly and structure your response into these specific sections. Use Markdown for formatting.
                
                **1. Document Purpose & Summary:**
                * Start with a single, clear sentence explaining what this document is (e.g., "This is a rental agreement...").
                * Then, provide a brief, easy-to-understand summary of its main purpose.
                
                **2. Key Benefits & Obligations for You:**
                * Use bullet points.
                * Clearly list what the person reading this gets (their rights/benefits).
                * Clearly list what the person reading this must do (their duties/obligations).
                
                **3. Potential Risks & Penalties (Under Indian Law):**
                * Explain the consequences of failing to meet the obligations.
                * Mention specific penalties, fines, or legal actions described in the document.
                * If the document is silent, refer to general penalties under relevant Indian laws (e.g., The Indian Contract Act, 1872). Be specific if possible.
                
                **4. Legal Recourse & Next Steps:**
                * Advise on what steps a person can take if the other party breaches the agreement.
                * Mention dispute resolution methods if included (e.g., arbitration, jurisdiction of courts).
                
                **Disclaimer:**
                * Conclude with a clear disclaimer: "This is a simplified summary and not legal advice. For critical decisions, please consult with a qualified legal professional."
                
                DOCUMENT TEXT:
                ---
                ${originalDocumentText}
                ---
            `;

            const simplifiedText = await callGemini(prompt);
            displayResponse(simplifiedText);
            document.getElementById('actionButtons').classList.remove('hidden');
            document.getElementById('chatSection').classList.remove('hidden');
            chatHistory = []; 
            document.getElementById('chatHistory').innerHTML = '';
        }

        /**
         * Translates the current summary to a selected language.
         */
        async function translateSummary() {
            const currentSummary = document.getElementById('responseBox').innerText;
            const targetLanguage = document.getElementById('languageSelector').value;
            const prompt = `Translate the following summary into the ${targetLanguage} language. Maintain the original formatting, including headings and bullet points.\n\nSummary:\n${currentSummary}`;
            const translatedText = await callGemini(prompt);
            displayResponse(translatedText);
        }

        /**
         * Asks a follow-up question about the document.
         */
        async function askQuestion() {
            const question = document.getElementById('chatInput').value.trim();
            if (!question) return;

            updateChatHistory('user', question);
            document.getElementById('chatInput').value = '';

            const prompt = `
                You are the 'Legalify Assistant', a helpful AI specializing in analyzing a specific legal document provided by the user. Your primary goal is to answer the user's questions based *only* on the information contained within that document.

                **Rules:**
                1.  **Stick to the Source:** Your answers must be directly derived from the 'Original Document' text below. Do not use external knowledge or make assumptions.
                2.  **If You Don't Know, Say So:** If the document does not contain the answer to the user's question, you must clearly state that. For example, say "I couldn't find information about that in the document provided."
                3.  **Keep it Simple:** Use clear, simple, and jargon-free language, just like in the initial summary.
                4.  **Be Conversational:** Answer in a helpful and direct tone.

                **Original Document:**
                ---
                ${originalDocumentText}
                ---

                **User's Question:** "${question}"
            `;
            
            const answer = await callGemini(prompt, false);
            updateChatHistory('model', answer);
        }

        /**
         * Displays the formatted response text in the output box.
         * @param {string} text - The text to display.
         */
        function displayResponse(text) {
            const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            document.getElementById('responseBox').innerHTML = formattedText;
        }
        
        /**
         * Adds a new message to the chat history UI.
         * @param {string} role - The role of the sender ('user' or 'model').
         * @param {string} text - The message content.
         */
        function updateChatHistory(role, text) {
            const chatHistoryDiv = document.getElementById('chatHistory');
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('p-2', 'rounded-lg', 'max-w-xs', 'md:max-w-md', 'fade-in');
            
            if (role === 'user') {
                messageDiv.classList.add('bg-blue-100', 'text-blue-900', 'ml-auto');
                messageDiv.textContent = text;
            } else {
                messageDiv.classList.add('bg-slate-200', 'text-slate-800', 'mr-auto');
                messageDiv.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            }
            
            chatHistoryDiv.appendChild(messageDiv);
            chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
        }

        /**
         * Prepares the summary content for printing and opens the print dialog.
         */
        function printSummary() {
            const summaryContent = document.getElementById('responseBox').innerHTML;
            const printContentDiv = document.getElementById('print-content');
            printContentDiv.innerHTML = `<h1>Legalify Document Summary</h1><hr>${summaryContent}`;
            window.print();
        }
        
        /**
         * Displays a simple notification message in the response box.
         * @param {string} message - The message to show.
         */
        function showMessage(message) {
            const responseBox = document.getElementById('responseBox');
            responseBox.innerHTML = `🔔 ${message}`;
        }
