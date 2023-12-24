document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    let touched = false;
    let x = -1, y = -1;
    let socket;
    const aspectRatio = 16 / 9;
    let logicalCanvasWidth = 0;
    let logicalCanvasHeight = 0;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    function resizeCanvas() {
        const controlsDivHeight = document.getElementById('controls').offsetHeight + 20;
        let availableHeight = window.innerHeight - controlsDivHeight;

        let newWidth = window.innerWidth;
        let newHeight = window.innerWidth / aspectRatio;

        // Adjust height based on the available height
        if (newHeight > availableHeight) {
            newHeight = availableHeight;
            newWidth = newHeight * aspectRatio;
        }

        // Store the logical canvas size
        logicalCanvasWidth = newWidth;
        logicalCanvasHeight = newHeight;

        // Set physical size of the canvas
        canvas.width = newWidth * window.devicePixelRatio;
        canvas.height = newHeight * window.devicePixelRatio;

        // Set display size of the canvas
        canvas.style.width = newWidth + 'px';
        canvas.style.height = newHeight + 'px';

        // Reset and scale the context
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.scale(window.devicePixelRatio, window.devicePixelRatio);

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Redraw the canvas after resizing
        fetchAndRedraw();
    }

    async function fetchAndRedraw() {
        try {
            const response = await fetch('https://' + location.hostname + '/sf/api/getdrawingdata');
            if (response.ok) {
                const drawingData = await response.json();
                drawingData.forEach(cmd => {
                    const parsedCmd = JSON.parse(cmd);
                    const drawingData = parsedCmd.data.split(" ");

                    // Extract coordinates and color
                    const scaledX1 = parseFloat(drawingData[0]);
                    const scaledY1 = parseFloat(drawingData[1]);
                    const scaledX2 = parseFloat(drawingData[2]);
                    const scaledY2 = parseFloat(drawingData[3]);
                    const color = drawingData[4];
                    draw(scaledX1, scaledY1, scaledX2, scaledY2, color);
                });
            } else {
                console.error('Failed to fetch drawing data');
            }
        } catch (error) {
            console.error('Error fetching drawing data:', error);
        }
    }

    window.addEventListener("resize", function () {
        resizeCanvas();
        fetchAndRedraw();
    });

    window.addEventListener("orientationchange", function () {
        resizeCanvas();
        fetchAndRedraw();
    });

    resizeCanvas();

    const saveButton = document.getElementById("save-button");

    saveButton.addEventListener('click', function () {
        const dataURL = canvas.toDataURL('image/png');
        const now = new Date();
        const timestamp = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0') + now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
        const link = document.createElement('a');
        link.download = `scribblefusion_${timestamp}.png`;
        link.href = dataURL;
        link.click();
    });

    function handleStart(e) {
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const rect = canvas.getBoundingClientRect();
        const scaleX = logicalCanvasWidth / rect.width;
        const scaleY = logicalCanvasHeight / rect.height;

        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;

        if (canvasX >= 0 && canvasX <= canvas.width && canvasY >= 0 && canvasY <= canvas.height) {
            touched = true;
            handleInteraction(e);
        }
    }

    function handleEnd() {
        touched = false;
        x = y = -1;
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchend', handleEnd);
    }

    function handleMove(e){
        e.preventDefault();
        if (touched) {
            let clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            const rect = canvas.getBoundingClientRect();
            const scaleX = logicalCanvasWidth / rect.width;
            const scaleY = logicalCanvasHeight / rect.height;

            const canvasX = (clientX - rect.left) * scaleX;
            const canvasY = (clientY - rect.top) * scaleY;

            if (canvasX >= 0 && canvasX <= canvas.width && canvasY >= 0 && canvasY <= canvas.height) {
                handleInteraction(e);
            }
        }
    }

    function handleInteraction(e) {
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const rect = canvas.getBoundingClientRect();
        const scaleX = logicalCanvasWidth / rect.width;   // Use actual canvas size for scaling
        const scaleY = logicalCanvasHeight / rect.height;

        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;

        const color = document.getElementById('color').value;
        if (touched) {
            draw(x / logicalCanvasWidth, y / logicalCanvasHeight, canvasX / logicalCanvasWidth, canvasY / logicalCanvasHeight, color);
            try {
                socket.send([x / logicalCanvasWidth, y / logicalCanvasHeight, canvasX / logicalCanvasWidth, canvasY / logicalCanvasHeight, color].join(' '));
            } catch (error) {
                console.error('Socket error:', error);
            }
        }
        x = canvasX;
        y = canvasY;
    }

    function startDrawing(e){
        handleStart(e);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);
    }

    function draw(scaledX1, scaledY1, scaledX2, scaledY2, color) {
        // Only draw if coordinates are valid
        if (scaledX1 >= 0 && scaledY1 >= 0 && scaledX2 >= 0 && scaledY2 >= 0) {
            let x1 = scaledX1 * logicalCanvasWidth;
            let y1 = scaledY1 * logicalCanvasHeight;
            const x2 = scaledX2 * logicalCanvasWidth;
            const y2 = scaledY2 * logicalCanvasHeight;

            context.strokeStyle = color.trim() || 'black';
            context.lineWidth = 3 / window.devicePixelRatio;
            context.beginPath();
            context.moveTo(x1, y1);
            context.lineTo(x2, y2);
            context.closePath();
            context.stroke();
        }
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('touchmove', handleMove);

    function connectWebSocket(retryInterval = 5000, maxRetries = 10) {
        let retryCount = 0;

        function attemptConnection() {
            try {
                socket = new WebSocket("wss://" + location.hostname);

                socket.onopen = function () {
                    console.log('WebSocket connection established');
                    document.getElementById('loading-message').style.display = 'none'; // Hide loading message
                    document.getElementById('container').style.display = 'block';
                    // Additional onopen logic can go here
                }

                socket.onerror = function () {
                    if (retryCount < maxRetries) {
                        console.log(`WebSocket connection failed, retrying... (${retryCount + 1}/${maxRetries})`);
                        setTimeout(attemptConnection, retryInterval);
                        retryCount++;
                    } else {
                        alert('Failed to connect to WebSocket server after maximum retries.');
                        document.getElementById('loading-message').style.display = 'none'; // Hide loading message
                    }
                }

                socket.onmessage = function (messageEvent) {
                    const msg = JSON.parse(messageEvent.data);

                    if (msg.time_remaining !== undefined) {
                        const timerElement = document.getElementById('time-remaining'); // Adjust with your actual timer element ID
                        timerElement.innerText = formatTime(msg.time_remaining);
                    }

                    if (msg.clear_canvas) {
                        context.clearRect(0, 0, canvas.width, canvas.height);
                        return;
                    }

                    if (Array.isArray(msg.data)) {
                        msg.data.forEach(function (drawingCommand) {
                            const drawingData = drawingCommand.split(" ");
                            draw(drawingData[0], drawingData[1], drawingData[2], drawingData[3], drawingData[4]);
                        });
                    } else if (msg.data) {
                        const drawingData = msg.data.split(" ");
                        draw(drawingData[0], drawingData[1], drawingData[2], drawingData[3], drawingData[4]);
                    }
                }
            } catch (e) {
                alert('Error connecting to WebSocket server.');
            }
        }

        document.getElementById('loading-message').style.display = 'block'; // Show loading message
        attemptConnection();
    }

    connectWebSocket();

    function formatTime(s) {
        return (s - (s %= 60)) / 60 + (9 < s ? ':' : ':0') + s;
    }

});
