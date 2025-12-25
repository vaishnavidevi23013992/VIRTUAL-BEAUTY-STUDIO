const state = {
    lipColor: '#c0392b', lipIntensity: 0.7,
    blushColor: '#fab1a0', blushIntensity: 0.5,
    eyeColor: '#a29bfe', eyeIntensity: 0.4,
    showMakeup: true
};

const LANDMARKS = {
    lipsUpperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
    lipsLowerOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
    lipsUpperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
    lipsLowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
    leftCheek: [123, 50, 205, 207, 187, 123],
    rightCheek: [266, 280, 425, 427, 352, 345, 266],
    leftEyeShadow: [226, 247, 30, 29, 27, 28, 56, 190, 243, 226],
    rightEyeShadow: [463, 414, 286, 258, 257, 259, 260, 446, 359, 463]
};

const video = document.querySelector('.input_video');
const canvas = document.querySelector('.output_canvas');
const ctx = canvas.getContext('2d');

function init() {
    createSwatches('lip-colors', ['#c0392b','#e84393','#8e44ad'], (c) => state.lipColor = c);
    createSwatches('blush-colors', ['#fab1a0','#ff7675','#fd79a8'], (c) => state.blushColor = c);
    createSwatches('eye-colors', ['#a29bfe','#74b9ff','#81ecec'], (c) => state.eyeColor = c);
    
    document.getElementById('lip-intensity').oninput = (e) => state.lipIntensity = e.target.value;
    document.getElementById('blush-intensity').oninput = (e) => state.blushIntensity = e.target.value;
    document.getElementById('eye-intensity').oninput = (e) => state.eyeIntensity = e.target.value;
    
    document.getElementById('take-screenshot').onclick = takeScreenshot;
    const compareBtn = document.getElementById('toggle-compare');
    compareBtn.onmousedown = () => state.showMakeup = false;
    compareBtn.onmouseup = () => state.showMakeup = true;
    
    const faceMesh = new FaceMesh({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`});
    faceMesh.setOptions({maxNumFaces: 1, refineLandmarks: true});
    faceMesh.onResults(onResults);
    
    new Camera(video, {
        onFrame: async () => await faceMesh.send({image: video}),
        width: 1280, height: 720
    }).start().then(() => document.getElementById('loading-spinner').style.display = 'none');
}

function createSwatches(id, colors, onClick) {
    const container = document.getElementById(id);
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.onclick = () => {
            container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            onClick(color);
        };
        container.appendChild(swatch);
    });
    container.firstChild?.classList.add('active');
}

function onResults(results) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.multiFaceLandmarks && state.showMakeup) {
        for (const landmarks of results.multiFaceLandmarks) {
            drawMakeup(landmarks);
        }
    }
}

function drawMakeup(landmarks) {
    if (state.lipColor) drawComplexLips(landmarks, state.lipColor, state.lipIntensity);
    if (state.blushColor) drawBlush(landmarks);
    if (state.eyeColor) {
        drawFeature(landmarks, LANDMARKS.leftEyeShadow, state.eyeColor, state.eyeIntensity);
        drawFeature(landmarks, LANDMARKS.rightEyeShadow, state.eyeColor, state.eyeIntensity);
    }
}

function drawComplexLips(landmarks, color, intensity) {
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    
    ctx.beginPath();
    LANDMARKS.lipsUpperOuter.forEach(idx => {
        const p = landmarks[idx];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    });
    LANDMARKS.lipsUpperInner.slice().reverse().forEach(idx => {
        const p = landmarks[idx];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    });
    ctx.fill();
    
    ctx.beginPath();
    LANDMARKS.lipsLowerOuter.forEach(idx => {
        const p = landmarks[idx];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    });
    LANDMARKS.lipsLowerInner.slice().reverse().forEach(idx => {
        const p = landmarks[idx];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    });
    ctx.fill();
    ctx.restore();
}

function drawBlush(landmarks) {
    drawCheek(landmarks, LANDMARKS.leftCheek, state.blushColor, state.blushIntensity);
    drawCheek(landmarks, LANDMARKS.rightCheek, state.blushColor, state.blushIntensity);
}

function drawCheek(landmarks, indices, color, intensity) {
    let xSum = 0, ySum = 0;
    indices.forEach(idx => { xSum += landmarks[idx].x; ySum += landmarks[idx].y; });
    const cx = (xSum / indices.length) * canvas.width;
    const cy = (ySum / indices.length) * canvas.height;
    const r = Math.abs(landmarks[indices[0]].x * canvas.width - cx) * 1.5;
    
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, hexToRgba(color, intensity));
    gradient.addColorStop(1, hexToRgba(color, 0));
    
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
}

function drawFeature(landmarks, indices, color, intensity) {
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.fillStyle = color;
    ctx.beginPath();
    indices.forEach(idx => {
        const p = landmarks[idx];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function takeScreenshot() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.save();
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.restore();
    
    tempCtx.drawImage(canvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = 'makeup-look.png';
    link.href = tempCanvas.toDataURL();
    link.click();
}

init();
