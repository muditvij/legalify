 const API_KEY = "AIzaSyDgHqrrTXR8apwWUxJSomJgw-BODNFoC-E"; // The execution environment will provide the key.
        const MODEL = "gemini-2.5-flash";
        let originalDocumentText = '';
        
        window.addEventListener('load', () => {
            const loader = document.getElementById('startup-loader');
            setTimeout(() => { loader.classList.add('hidden'); }, 2500);
        });

        function showTab(tabName) {
            document.getElementById('textInputArea').classList.toggle('hidden', tabName !== 'text');
            document.getElementById('pdfInputArea').classList.toggle('hidden', tabName !== 'pdf');
            ['textTab', 'pdfTab'].forEach(id => {
                const tab = document.getElementById(id);
                tab.classList.toggle('text-blue-600', id.startsWith(tabName));
                tab.classList.toggle('border-blue-600', id.startsWith(tabName));
                tab.classList.toggle('text-gray-500', !id.startsWith(tabName));
            });
        }

        function clearInputs() {
            document.getElementById('userInput').value = '';
            document.getElementById('pdfInput').value = '';
            document.getElementById('pdfFileName').textContent = 'Click to upload a PDF file';
            document.getElementById('responseBox').innerHTML = 'Your simplified summary will appear here.';
            document.getElementById('actionButtons').classList.add('hidden');
            document.getElementById('chatSection').classList.add('hidden');
            originalDocumentText = '';
        }

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
                };
                reader.readAsArrayBuffer(file);
            } catch (error) {
                console.error("PDF processing error:", error);
                showMessage("Error processing PDF. Please ensure it's a valid file.");
                loader.classList.add('hidden');
            }
        }

        async function callGemini(prompt, showLoading = true) {
            if (showLoading) document.getElementById('loader').classList.remove('hidden');
            const maxRetries = 3;
            let delay = 1000; // 1 second initial delay

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (!text) throw new Error("No valid response from the model.");
                        if (showLoading) document.getElementById('loader').classList.add('hidden');
                        return text;
                    }

                    if (response.status === 429 || response.status >= 500) {
                         throw new Error(`API temporarily unavailable (Status: ${response.status})`);
                    }

                    const errorData = await response.json();
                    if (showLoading) document.getElementById('loader').classList.add('hidden');
                    return `❌ **Error:** An issue occurred with the request. (${errorData.error?.message || `API Error: ${response.status}`})`;

                } catch (err) {
                    console.warn(`Attempt ${attempt + 1} of ${maxRetries} failed: ${err.message}`);
                    if (attempt === maxRetries - 1) {
                        console.error("Gemini API Error after all retries:", err);
                        if (showLoading) document.getElementById('loader').classList.add('hidden');
                        return `❌ **Error:** Could not get a response. The model appears to be overloaded. Please try again in a few moments.`;
                    }
                    await new Promise(res => setTimeout(res, delay));
                    delay *= 2;
                }
            }
            if (showLoading) document.getElementById('loader').classList.add('hidden');
            return `❌ **Error:** Could not get a response after multiple attempts.`;
        }

        async function simplifyDocument() {
            const plainTextDocument = document.getElementById("userInput").value.trim();
            if (plainTextDocument.length < 50) {
                showMessage("The provided text is too short. Please input a valid legal document.");
                return;
            }

            try {
                const secretKey = "a-very-secret-key-for-legalify-demo";
                const encryptedDocument = CryptoJS.AES.encrypt(plainTextDocument, secretKey).toString();
                console.log("Encrypted for transit (demonstration):", encryptedDocument.substring(0, 50) + "...");
                const bytes = CryptoJS.AES.decrypt(encryptedDocument, secretKey);
                originalDocumentText = bytes.toString(CryptoJS.enc.Utf8);
                if (!originalDocumentText) throw new Error("Decryption failed, resulting in empty text.");
            } catch (error) {
                console.error("Client-side Encryption/Decryption Error:", error);
                showMessage("A local security error occurred. Please refresh and try again.");
                return;
            }

            const prompt = `
                CONTEXT:
                - You are an expert legal analyst based in Agra, Uttar Pradesh, India.
                - The current date is August 31, 2025. Your analysis must be relevant to current Indian law.
                - Your audience is a common citizen who needs a clear, simple, and direct explanation. Avoid complex legal jargon completely.
                - Your tone must be helpful, professional, and reassuring.

                TASK:
                Analyze the legal document provided below. Structure your response EXACTLY as follows, using Markdown for formatting (use ** for bold headings and * for bullet points).

                **1. What is this Document?**
                * In one single, simple sentence, explain the document's primary purpose (e.g., "This is a rental agreement for a property," or "This is a non-disclosure agreement to protect confidential company information.").

                **2. Your Rights (Pros)**
                * Based on the document, create a bulleted list of the key benefits, rights, and advantages this document gives to the person signing it.

                **3. Your Responsibilities (Cons)**
                * Based on the document, create a bulleted list of the key duties, obligations, and responsibilities the person signing it must fulfill.

                **4. Critical Red Flags & Important Clauses**
                * Carefully identify and explain any clauses that are unusual, one-sided, or require special attention. This is the most important section. Point out things that could be easily missed but have significant negative consequences. If there are no major red flags, state that the document appears to be standard.

                **5. Consequences of Breach (Maximum Penalties)**
                * Explain the worst-case scenario if the agreement is broken by the person signing it.
                * Detail the maximum legal and financial penalties mentioned in the document or applicable under relevant Indian laws (e.g., The Indian Contract Act, 1872; The Information Technology Act, 2000). Be specific about potential fines, legal action, or other damages.

                **6. How to Resolve a Dispute**
                * Outline the specific steps for resolving a disagreement as described in the document (e.g., Arbitration in a specific city, which court has jurisdiction). If the document is silent on this, suggest standard legal routes in India.

                **Disclaimer:**
                * Conclude with this exact text: "This is a simplified analysis and not a substitute for professional legal advice. For critical decisions, it is essential to consult with a qualified lawyer."

                DOCUMENT TO ANALYZE:
                ---
                ${originalDocumentText}
                ---
            `;
            const simplifiedText = await callGemini(prompt);
            displayResponse(simplifiedText);
            document.getElementById('actionButtons').classList.remove('hidden');
            document.getElementById('chatSection').classList.remove('hidden');
            document.getElementById('chatHistory').innerHTML = '';
        }

        async function translateSummary() {
            const currentSummary = document.getElementById('responseBox').innerText;
            const targetLanguage = document.getElementById('languageSelector').value;
            const prompt = `Translate the following summary into ${targetLanguage}. Maintain original formatting.\n\nSummary:\n${currentSummary}`;
            const translatedText = await callGemini(prompt);
            displayResponse(translatedText);
        }

        async function askQuestion() {
            const question = document.getElementById('chatInput').value.trim();
            if (!question) return;
            updateChatHistory('user', question);
            document.getElementById('chatInput').value = '';
            const prompt = `
                You are the 'Legalify Assistant', an AI answering questions about a legal document that has already been summarized for a user.

                **Rules:**
                1.  **Strictly Use the Document:** Base your answers ONLY on the 'Original Document Text' provided below. Do not use external knowledge.
                2.  **Acknowledge Limits:** If the answer is not in the document, state clearly: "The document does not provide information on that topic."
                3.  **Stay Simple:** Use clear, simple language. Avoid legal jargon.

                **Original Document Text:**
                ---
                ${originalDocumentText}
                ---
                
                **User's Question:** "${question}"
            `;
            const answer = await callGemini(prompt, false);
            updateChatHistory('model', answer);
        }

        function displayResponse(text) {
            const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            document.getElementById('responseBox').innerHTML = formattedText;
        }

        function updateChatHistory(role, text) {
            const chatHistoryDiv = document.getElementById('chatHistory');
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('p-2', 'rounded-lg', 'max-w-xs', 'md:max-w-md', 'fade-in');
            if (role === 'user') {
                messageDiv.classList.add('bg-blue-100', 'text-blue-800', 'ml-auto');
                messageDiv.textContent = text;
            } else {
                messageDiv.classList.add('bg-gray-200', 'text-gray-800', 'mr-auto');
                messageDiv.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            }
            chatHistoryDiv.appendChild(messageDiv);
            chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
        }

        function printSummary() {
            const summaryContent = document.getElementById('responseBox').innerHTML;
            const printContentDiv = document.getElementById('print-content');
            printContentDiv.innerHTML = `<h1>Legalify Document Summary</h1><hr>${summaryContent}`;
            window.print();
        }

        function showMessage(message) {
            document.getElementById('responseBox').innerHTML = `🔔 ${message}`;
        }
