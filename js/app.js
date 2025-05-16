// frontend/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. app.js executing.");

    // DOM Element References
    const videoForm = document.getElementById('video-form');
    const videoUrlInput = document.getElementById('video-url');
    const searchIntentInput = document.getElementById('search-intent');
    const processButton = document.getElementById('process-button');

    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageDiv = document.getElementById('error-message');

    const outputSection = document.getElementById('output-section');
    const summaryContentDiv = document.getElementById('summary-content');
    const tocListUl = document.getElementById('toc-list');
    const fullArticleTextDiv = document.getElementById('full-article-text');
    const copyToClipboardButton = document.getElementById('copy-to-clipboard');

    const videoPlayerSection = document.getElementById('video-player-section');
    const youtubePlayerContainer = document.getElementById('youtube-player-container');
    const videoPlayerTitle = document.getElementById('video-player-title');

    const sidebarHistory = document.getElementById('sidebar-history');
    const historyListUl = document.getElementById('history-list');
    const noHistoryP = document.getElementById('no-history');

    // Configuration
    const API_BASE_URL = ''; // Use empty string for root-relative API calls to Vercel Serverless Functions
    const MAX_HISTORY_ITEMS = 5;

    // State
    let ytPlayer;
    let currentVideoId = null;
    let isYouTubeApiReady = false;
    let pendingVideoToLoad = null;
    let history = [];
    let currentActiveHistoryItem = null;

    // --- YouTube IFrame API Setup ---
    window.onYouTubeIframeAPIReady = function() {
        console.log("YouTube IFrame API is ready.");
        isYouTubeApiReady = true;
        if (pendingVideoToLoad && pendingVideoToLoad.videoId) {
            createYouTubePlayer(pendingVideoToLoad.videoId, pendingVideoToLoad.videoTitle);
            pendingVideoToLoad = null;
        }
    };

    function createYouTubePlayer(videoId, videoTitle) {
        currentVideoId = videoId;
        videoPlayerSection.style.display = 'block';
        videoPlayerTitle.textContent = videoTitle || "Video Player";

        youtubePlayerContainer.innerHTML = ''; // Clear previous player if any
        console.log(`Creating new YT.Player for videoId: ${videoId}`);

        ytPlayer = new YT.Player(youtubePlayerContainer, {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'autoplay': 0,
                'controls': 1
            },
            events: {
                'onReady': (event) => {
                    console.log("Player ready for video:", videoId, event.target);
                },
                'onError': (event) => {
                    console.error("YouTube Player Error Code:", event.data);
                    let errorReason = "Unknown player error.";
                    switch(event.data) {
                        case 2: errorReason = "Invalid parameter value. Check video ID."; break;
                        case 5: errorReason = "HTML5 player error."; break;
                        case 100: errorReason = "Video not found or removed."; break;
                        case 101: case 150: errorReason = "Embedding disabled by the video owner."; break;
                    }
                    // Avoid displaying this error if a more specific API error is already shown
                    if (!errorMessageDiv.textContent.includes("API Error")) {
                        displayError(`YouTube Player Error: ${errorReason} (Code ${event.data})`);
                    }
                }
            }
        });
    }

    function loadOrUpdateYouTubePlayer(videoId, videoTitle) {
        if (!videoId) {
            console.log("No videoId provided, hiding player.");
            videoPlayerSection.style.display = 'none';
            if(ytPlayer && typeof ytPlayer.destroy === 'function') {
                try { ytPlayer.destroy(); } catch(e) { console.warn("Error destroying player:", e); }
                ytPlayer = null;
            }
            currentVideoId = null;
            return;
        }

        if (isYouTubeApiReady) {
            if (ytPlayer && typeof ytPlayer.loadVideoById === 'function' && currentVideoId === videoId) {
                // Video ID is the same, ensure player is visible and title is updated
                videoPlayerSection.style.display = 'block';
                videoPlayerTitle.textContent = videoTitle || "Video Player";
            } else if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
                console.log(`Player exists. Loading new videoId via loadVideoById: ${videoId}`);
                videoPlayerSection.style.display = 'block';
                videoPlayerTitle.textContent = videoTitle || "Video Player";
                ytPlayer.loadVideoById(videoId);
                currentVideoId = videoId;
            } else {
                // No player or different video, create new player
                createYouTubePlayer(videoId, videoTitle);
            }
        } else {
            console.log("YouTube API not ready yet. Queuing video load:", videoId);
            pendingVideoToLoad = { videoId, videoTitle };
        }
    }

    // --- Timestamp Link Click Handler ---
    function handleTimestampLinkClick(event) {
        const targetLink = event.target.closest('a.youtube-timestamp-link');
        if (targetLink) {
            event.preventDefault();

            const videoIdFromLink = targetLink.dataset.videoId;
            const timeParam = targetLink.dataset.timestamp;
            const timestampInSeconds = parseInt(timeParam);

            console.log(`Timestamp link clicked: videoId=${videoIdFromLink}, time=${timestampInSeconds}s`);

            if (isNaN(timestampInSeconds)) {
                console.error("Invalid timestamp in link:", timeParam);
                return;
            }

            if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
                if (currentVideoId === videoIdFromLink) {
                    console.log(`Seeking current player to: ${timestampInSeconds}`);
                    ytPlayer.playVideo(); // Start playing if not already
                    // A slight delay can help ensure seekTo works after playVideo command
                    setTimeout(() => {
                        ytPlayer.seekTo(timestampInSeconds, true);
                        // Ensure it's playing after seek, sometimes it might pause
                        if (ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
                           ytPlayer.playVideo();
                        }
                    }, 150); // 150ms delay, adjust if needed

                    videoPlayerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    // If video is different, ideally load it first, then seek.
                    // For now, just log a warning or consider implementing this.
                    console.warn(`Clicked timestamp for video ${videoIdFromLink}, but player has ${currentVideoId} loaded. Consider loading new video.`);
                    // Potentially: loadOrUpdateYouTubePlayer(videoIdFromLink, "Video Title from History/Data"); then seek.
                }
            } else {
                console.error("YouTube player (ytPlayer) is not available or seekTo is not a function.");
            }
        }
    }
    fullArticleTextDiv.addEventListener('click', handleTimestampLinkClick);


    // --- Helper Functions ---
    function displayError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        outputSection.style.display = 'none';
        // videoPlayerSection.style.display = 'none'; // Keep player if it was for a previous successful video
        copyToClipboardButton.style.display = 'none';
    }

    function clearError() {
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.display = 'none';
    }

    function showLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.style.display = 'block';
            processButton.disabled = true;
            processButton.textContent = 'Processing...';
        } else {
            loadingIndicator.style.display = 'none';
            processButton.disabled = false;
            processButton.textContent = 'Process Video';
        }
    }

    function updateHistory(articleData) {
        if (!articleData || !articleData.video_data || !articleData.video_data.video_id) {
            console.warn("Attempted to add invalid article data to history.", articleData);
            return;
        }
        // Remove existing entry for the same video ID to avoid duplicates and move to top
        const existingIndex = history.findIndex(item => item.video_data.video_id === articleData.video_data.video_id);
        if (existingIndex > -1) {
            history.splice(existingIndex, 1);
        }
        history.unshift(articleData); // Add to the beginning
        if (history.length > MAX_HISTORY_ITEMS) {
            history.pop(); // Remove the oldest if exceeding max
        }
        renderHistoryList();
        // Persist to localStorage (optional, for cross-session history)
        // try { localStorage.setItem('videoArticleHistory', JSON.stringify(history)); } catch (e) { console.warn("Could not save history to localStorage", e); }
    }

    function renderHistoryList() {
        historyListUl.innerHTML = ''; // Clear existing list
        if (history.length === 0) {
            noHistoryP.style.display = 'block';
            historyListUl.style.display = 'none';
        } else {
            noHistoryP.style.display = 'none';
            historyListUl.style.display = 'block';
            history.forEach((articleData, index) => {
                const listItem = document.createElement('li');
                listItem.className = 'p-2 hover:bg-gray-200 rounded cursor-pointer text-sm text-gray-600 truncate';
                listItem.textContent = articleData.video_data.title || 'Untitled Video';
                listItem.title = articleData.video_data.title || 'Untitled Video'; // Tooltip for full title
                listItem.dataset.historyIndex = index; // Store index for retrieval
                listItem.addEventListener('click', () => {
                    loadArticleFromHistory(index);
                });
                historyListUl.appendChild(listItem);
            });
        }
    }

    function setActiveHistoryItem(articleVideoId) {
        const listItems = historyListUl.querySelectorAll('li');
        let itemToActivate = null;

        listItems.forEach(item => {
            item.classList.remove('active-history-item'); // Reset all items
            const itemIndex = parseInt(item.dataset.historyIndex);
            if (history[itemIndex] && history[itemIndex].video_data.video_id === articleVideoId) {
                itemToActivate = item;
            }
        });

        if (itemToActivate) {
            itemToActivate.classList.add('active-history-item');
            currentActiveHistoryItem = itemToActivate;
        } else {
            currentActiveHistoryItem = null;
        }
    }

    function loadArticleFromHistory(index) {
        if (index >= 0 && index < history.length) {
            const articleData = history[index];
            console.log("Loading from history:", articleData.video_data.title);
            // Render the output without treating it as a new submission (won't re-add to history top)
            renderOutput(articleData, false);
        }
    }

    function renderOutput(data, isNewSubmission = true) {
        clearError();
        outputSection.style.display = 'block';

        if (data.video_data && data.video_data.video_id) {
            loadOrUpdateYouTubePlayer(data.video_data.video_id, data.video_data.title);
            if (isNewSubmission) {
                updateHistory(data); // Update history only for new submissions
            }
            setActiveHistoryItem(data.video_data.video_id); // Set active item whether new or from history
        } else {
            // No video data, hide player and clear active history item
            loadOrUpdateYouTubePlayer(null, null);
            if (currentActiveHistoryItem) {
                currentActiveHistoryItem.classList.remove('active-history-item');
                currentActiveHistoryItem = null;
            }
        }

        // Summary
        if (data.llm_article_data && data.llm_article_data.summary) {
            summaryContentDiv.innerHTML = ''; // Clear previous
            const summaryParagraph = document.createElement('p');
            // Basic formatting: replace newlines with <br> for display
            summaryParagraph.innerHTML = data.llm_article_data.summary.replace(/\n- /g, '<br>- ').replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
            summaryContentDiv.appendChild(summaryParagraph);
        } else {
            summaryContentDiv.innerHTML = '<p>No summary available.</p>';
        }

        // Table of Contents
        tocListUl.innerHTML = ''; // Clear previous
        if (data.llm_article_data && data.llm_article_data.table_of_contents && data.llm_article_data.table_of_contents.length > 0) {
            data.llm_article_data.table_of_contents.forEach((item, index) => {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                // Create a somewhat unique ID for linking, converting item to lowercase and replacing spaces
                const sectionId = `section-${encodeURIComponent(item.replace(/\s+/g, '-').toLowerCase())}`;
                link.href = `#${sectionId}`;
                link.textContent = item;
                link.className = "hover:underline text-indigo-600 hover:text-indigo-800"; // Added styling
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetElement = document.getElementById(sectionId);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
                listItem.appendChild(link);
                tocListUl.appendChild(listItem);
            });
        } else {
            tocListUl.innerHTML = '<li>No table of contents available.</li>';
        }


        // Full Article Text
        fullArticleTextDiv.innerHTML = ''; // Clear previous
        if (data.llm_article_data && data.llm_article_data.article_sections && data.llm_article_data.article_sections.length > 0) {
            data.llm_article_data.article_sections.forEach((section_item, index) => {
                const sectionContainer = document.createElement('div');
                sectionContainer.className = 'mb-6';
                // Use section_item.heading for ID generation, with a fallback for untitled sections
                const sectionId = `section-${encodeURIComponent(section_item.heading?.replace(/\s+/g, '-').toLowerCase() || `untitled-section-${index}`)}`;
                sectionContainer.id = sectionId;

                const heading = document.createElement('h4');
                heading.className = 'text-lg font-semibold mb-2 text-gray-800';
                heading.textContent = section_item.heading || 'Untitled Section';
                sectionContainer.appendChild(heading);

                const contentBlockText = section_item.content_block || '';
                const timestampSeconds = section_item.timestamp_seconds;

                // Create paragraphs from content_block, splitting by newline characters
                const paragraphs = contentBlockText
                                    .replace(/\r\n/g, '\n') // Normalize line endings
                                    .split(/\n+/)           // Split by one or more newlines
                                    .filter(p => p.trim() !== ''); // Remove empty paragraphs

                let contentHtml = paragraphs.map(pText => `<p class="mb-2">${pText}</p>`).join('');


                // Append timestamp icon if timestamp_seconds is valid and we have video data
                if (timestampSeconds !== null && !isNaN(parseFloat(timestampSeconds)) && data.video_data && data.video_data.video_id) {
                    const totalSeconds = parseFloat(timestampSeconds);
                    const displayHours = Math.floor(totalSeconds / 3600);
                    const remainingSecondsAfterHours = totalSeconds % 3600;
                    const displayMinutes = Math.floor(remainingSecondsAfterHours / 60);
                    const displaySeconds = Math.floor(remainingSecondsAfterHours % 60);
                    const formattedTimeForTitle = `${String(displayHours).padStart(2, '0')}:${String(displayMinutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}`;
                    const playIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 inline-block align-middle ml-1 text-indigo-600 hover:text-indigo-800"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>`;

                    const timestampLink = ` <a href="#" 
                                               data-video-id="${data.video_data.video_id}" 
                                               data-timestamp="${Math.floor(totalSeconds)}" 
                                               class="youtube-timestamp-link" 
                                               title="Play from ${formattedTimeForTitle}">${playIconSvg}</a>`;
                    
                    // Append the timestamp link. If contentHtml ends with </p>, insert before. Otherwise, just append.
                    if (contentHtml.endsWith('</p>')) {
                        contentHtml = contentHtml.substring(0, contentHtml.length - 4) + timestampLink + '</p>';
                    } else if (contentHtml.trim() === '') { // If no text content, just the icon link
                        contentHtml = `<p class="mb-2">${timestampLink}</p>`;
                    }
                     else {
                        contentHtml += timestampLink; // Append to existing non-paragraph content or as a new line
                    }
                }
                
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = contentHtml;


                if (section_item.relevant_to_search_intent) {
                    sectionContainer.classList.add('bg-yellow-100', 'border-l-4', 'border-yellow-500', 'p-3', 'rounded-r-md');
                }

                sectionContainer.appendChild(contentDiv);
                fullArticleTextDiv.appendChild(sectionContainer);
            });
        } else {
            fullArticleTextDiv.innerHTML = '<p>No article content available.</p>';
        }

        // Copy to Clipboard Button
        if (data.llm_article_data && (data.llm_article_data.summary || (data.llm_article_data.article_sections && data.llm_article_data.article_sections.length > 0))) {
            copyToClipboardButton.style.display = 'inline-block';
        } else {
            copyToClipboardButton.style.display = 'none';
        }

        // Scroll to output only for new submissions
        if (isNewSubmission) {
             outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }


    // --- Form Submission ---
    if (videoForm) {
        videoForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearError();
            showLoading(true);

            let rawVideoUrl = videoUrlInput.value.trim();
            const searchIntentValue = searchIntentInput.value.trim();

            if (!rawVideoUrl) {
                displayError('Please enter a YouTube video URL.');
                showLoading(false);
                return;
            }

            // --- START: New URL Formatting Logic ---
            const questionMarkIndex = rawVideoUrl.indexOf('?');
            let formattedVideoUrl = rawVideoUrl;

            if (questionMarkIndex !== -1) {
                formattedVideoUrl = rawVideoUrl.substring(0, questionMarkIndex);
            }
            // --- END: New URL Formatting Logic ---

            // Validate the *formatted* URL before sending
            try {
                new URL(formattedVideoUrl); // General URL format check
                // YouTube specific format check
                if (!/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/.test(formattedVideoUrl)) {
                    displayError('URL must be a valid YouTube video link (e.g., youtube.com/watch?v=... or youtu.be/...).');
                    showLoading(false);
                    return;
                }
            } catch (error) {
                displayError('Please enter a valid URL format (e.g., https://www.youtube.com/watch?v=...).');
                showLoading(false);
                return;
            }

            try {
                const requestBody = { video_url: formattedVideoUrl };
                if (searchIntentValue) { requestBody.search_intent = searchIntentValue; }

                // API call to Vercel Serverless Function
                const response = await fetch(`/api/process-video`, { // Path relative to Vercel deployment root
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                showLoading(false); // Hide loading indicator after fetch attempt

                let data;
                try {
                    data = await response.json(); // Try to parse JSON regardless of status for more info
                } catch (e) {
                    // If response is not JSON (e.g. HTML error page from proxy/Vercel)
                    console.error('API response was not JSON:', e);
                    displayError(`An unexpected error occurred. Status: ${response.status}. Please check server logs.`);
                    outputSection.style.display = 'none';
                    videoPlayerSection.style.display = 'none';
                    copyToClipboardButton.style.display = 'none';
                    return;
                }


                console.log('API Response Status:', response.status);
                console.log('API Response Data:', data);


                if (!response.ok) {
                    console.error('API Error Response Data:', data);
                    // Use detail from FastAPI (if available and proxied) or a generic message
                    const errorMessage = data.detail || data.message || `An API error occurred: ${response.status}`;
                    displayError(errorMessage);
                    outputSection.style.display = 'none';
                    // videoPlayerSection.style.display = 'none'; // Keep player if previously successful
                    copyToClipboardButton.style.display = 'none';
                    return;
                }

                // Handle cases where response is OK, but data might indicate an issue from backend logic
                if (data.message?.toLowerCase().includes("failed") || (data.video_data && data.video_data.error)) {
                    displayError(data.message || (data.video_data && data.video_data.error) || "Processing failed, please check the video URL or try again.");
                    outputSection.style.display = 'none';
                    copyToClipboardButton.style.display = 'none';
                } else if (data.llm_article_data && data.llm_article_data.summary?.toLowerCase().includes("error:")) {
                     // Specifically handle errors reported in the LLM summary
                    displayError(`Processing Error: ${data.llm_article_data.summary}`);
                    outputSection.style.display = 'none';
                    copyToClipboardButton.style.display = 'none';
                } else if (data.llm_article_data && (data.llm_article_data.summary || (data.llm_article_data.article_sections && data.llm_article_data.article_sections.length > 0))) {
                    // Successful processing with article data
                    renderOutput(data, true);
                } else if (data.video_data && !data.llm_article_data && !data.video_data.error) {
                    // Successfully fetched video metadata but no LLM article (e.g., no transcript)
                     renderOutput(data, true); // Still render what we have
                     // Optionally, display a specific message if llm_article_data is null/empty
                     if (!data.llm_article_data || (!data.llm_article_data.summary && (!data.llm_article_data.article_sections || data.llm_article_data.article_sections.length === 0))) {
                        summaryContentDiv.innerHTML = '<p>Video metadata fetched, but no article content could be generated (e.g., missing transcript or LLM processing issue).</p>';
                        tocListUl.innerHTML = '';
                        fullArticleTextDiv.innerHTML = '';
                     }
                }
                else {
                    // Fallback for unexpected successful responses without clear article data or known errors
                    displayError("Received data from backend, but no article content was generated or an unknown error occurred.");
                    outputSection.style.display = 'none';
                    copyToClipboardButton.style.display = 'none';
                }

            } catch (error) { // Catch network errors or issues with the fetch call itself
                console.error('Fetch API Call Error (outer catch):', error);
                showLoading(false);
                displayError('Failed to connect to the server or network error. Please try again.');
                outputSection.style.display = 'none';
                videoPlayerSection.style.display = 'none';
                copyToClipboardButton.style.display = 'none';
            }
        });
    } else {
        console.error("Video form not found!");
    }

    // --- Copy to Clipboard ---
    if(copyToClipboardButton) {
        copyToClipboardButton.addEventListener('click', () => {
            let textToCopy = "";
            const articleTitleElement = document.getElementById('video-player-title');
            const articleTitle = articleTitleElement ? articleTitleElement.textContent : "Video Article";
            textToCopy += articleTitle + "\n\n";

            const summaryText = summaryContentDiv.innerText?.trim();
            if (summaryText && !summaryText.toLowerCase().includes("no summary")) {
                textToCopy += "Summary:\n" + summaryText + "\n\n";
            }

            const tocItems = tocListUl.querySelectorAll('li a');
            if (tocItems.length > 0 && !tocListUl.textContent.toLowerCase().includes("no table of contents")) {
                textToCopy += "Table of Contents:\n";
                tocItems.forEach(link => {
                    textToCopy += "- " + link.textContent.trim() + "\n";
                });
                textToCopy += "\n";
            }

            const fullArticleElement = document.getElementById('full-article-text');
            if (fullArticleElement && fullArticleElement.innerText?.trim() && !fullArticleElement.innerText.toLowerCase().includes("no article content")) {
                textToCopy += "Full Article:\n";
                const sections = fullArticleElement.querySelectorAll('div.mb-6'); // Assuming each section is in such a div
                sections.forEach(sectionDiv => {
                    const heading = sectionDiv.querySelector('h4');
                    // Attempt to get only paragraph text, excluding the SVG link text if possible
                    let contentText = "";
                    const contentParagraphs = sectionDiv.querySelectorAll('div > p'); // Paragraphs inside content div

                    if (contentParagraphs.length > 0) {
                        contentParagraphs.forEach(p => {
                            // Clone the paragraph, remove the timestamp link, then get innerText
                            const pClone = p.cloneNode(true);
                            const timestampLinkClone = pClone.querySelector('a.youtube-timestamp-link');
                            if (timestampLinkClone) {
                                timestampLinkClone.remove();
                            }
                            contentText += pClone.innerText.trim() + "\n";
                        });
                    } else { // Fallback if content is not in <p> tags directly under the content div
                        const directContentDiv = sectionDiv.querySelector('div'); // The div holding content (after h4)
                         if (directContentDiv) {
                            const divClone = directContentDiv.cloneNode(true);
                            const tsLinksInDiv = divClone.querySelectorAll('a.youtube-timestamp-link');
                            tsLinksInDiv.forEach(link => link.remove());
                            contentText = divClone.innerText.trim();
                         }
                    }
                    
                    if (heading) {
                        textToCopy += "\n## " + heading.innerText.trim() + "\n";
                    }
                    if (contentText.trim()) {
                        textToCopy += contentText.trim().replace(/\n+/g, '\n') + "\n\n"; // Ensure single newlines between paragraphs from contentText
                    }
                });
            }

            textToCopy = textToCopy.trim(); // Final trim
            if (textToCopy.replace(articleTitle, "").trim()) { // Check if there's more than just the title
                navigator.clipboard.writeText(textToCopy).then(() => {
                    alert('Article content copied to clipboard!');
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy text. See console for details.');
                });
            } else {
                alert('No content available to copy.');
            }
        });
    }

    // Initial Load
    // Load history from localStorage (optional)
    // try {
    //     const storedHistory = localStorage.getItem('videoArticleHistory');
    //     if (storedHistory) {
    //         history = JSON.parse(storedHistory);
    //     }
    // } catch (e) { console.warn("Could not load history from localStorage", e); }
    renderHistoryList(); // Render history on page load (will show "no history" if empty)
});