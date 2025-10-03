let converting = false;
let cancelled = false;
let lottieDetails = null;
let frameSrc = {};
let previewInterval = null;
let selectedFrames = new Set();

const logContainer = document.querySelector("#logs");
const playerCanvas = document.querySelector("#lottie-player");
const player = document.querySelector("#lottie-player").player;
const sprites = document.querySelector("#sprites");
const btnLoad = document.querySelector("#load");
const btnConvert = document.querySelector("#convert");
const btnDownload = document.querySelector("#download");
const inputSpriteName = document.querySelector("#sprite-name");
const inputLottieUrl = document.querySelector("#lottieUrl");
const inputWidth = document.querySelector("#width");
const inputHeight = document.querySelector("#height");
const inputScale = document.querySelector("#scale");
const inputOWidth = document.querySelector("#o-width");
const inputOHeight = document.querySelector("#o-height");
const inputOFps = document.querySelector("#o-fps");
const inputFps = document.querySelector("#fps");
const inputOFrames = document.querySelector("#o-frames");
const inputFrames = document.querySelector("#frames");
const preview = document.querySelector("#preview");

const log = message => {
  const msgElem = document.createElement("p");
  msgElem.innerText = message;
  logContainer.appendChild(msgElem);
  logContainer.scrollTop = logContainer.scrollHeight;
};

const loadAsImage = markup => {
  const img = new Image();
  return new Promise((res, rej) => {
    img.onload = e => res(img);
    img.onerror = rej;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
  });
};

const frameMapping = (sourceFrames, targetFrames) => {
  const mapping = {};

  if (sourceFrames === targetFrames) {
    // Direct 1:1 mapping
    for (let i = 0; i < targetFrames; i++) {
      mapping[i] = i;
    }
  } else if (sourceFrames > targetFrames) {
    const step = sourceFrames / targetFrames;
    for (let i = 0; i < targetFrames; i++) {
      const sourceFrame = Math.floor(i * step);
      mapping[i] = Math.min(sourceFrame, sourceFrames - 1);
    }
  } else {
    const step = targetFrames / sourceFrames;
    for (let i = 0; i < targetFrames; i++) {
      const sourceFrame = Math.floor(i / step);
      mapping[i] = Math.min(sourceFrame, sourceFrames - 1);
    }
  }

  return mapping;
}

const toggleFrameSelection = (frameNumber) => {
  if (selectedFrames.has(frameNumber)) {
    selectedFrames.delete(frameNumber);
  } else {
    selectedFrames.add(frameNumber);
  }
  updateDownloadButton();
  updatePreview();
}

const updateDownloadButton = () => {
  if (btnDownload) {
    btnDownload.disabled = selectedFrames.size === 0;
  }
}

const updateFrameVisualState = (imgElement, frameNumber) => {
  if (selectedFrames.has(frameNumber)) {
    imgElement.style.border = '2px solid #007bff';
    imgElement.style.boxShadow = '0 0 5px rgba(0, 123, 255, 0.5)';
  } else {
    imgElement.style.border = '2px solid #ccc';
    imgElement.style.boxShadow = 'none';
  }
}

const updatePreview = () => {
  if (previewInterval) {
    clearInterval(previewInterval);
    previewInterval = null;
  }
  
  if (selectedFrames.size === 0) {
    preview.style.display = 'none';
    return;
  }
  
  const selectedFramesArray = Array.from(selectedFrames).sort((a, b) => a - b);
  let currentFrameIndex = 0;
  preview.src = frameSrc[selectedFramesArray[0]];
  preview.style.display = 'block';
  
  const interval = 1000 / inputFps.value;
  previewInterval = setInterval(() => {
    currentFrameIndex = (currentFrameIndex + 1) % selectedFramesArray.length;
    preview.src = frameSrc[selectedFramesArray[currentFrameIndex]];
  }, interval);
}

const convert = async () => {
  Object.values(frameSrc).forEach(url => 
    URL.revokeObjectURL(url)
  );
  frameSrc = {};
  selectedFrames.clear();
  preview.style.display = 'none';
  if (previewInterval) {
    clearInterval(previewInterval);
    previewInterval = null;
  }
  updateDownloadButton();

  if (converting) {
    cancelled = true;
    converting = false;
    btnConvert.textContent = 'Convert to Sprite';
    return;
  }

  sprites.innerHTML = '';
  converting = true;
  cancelled = false;
  btnConvert.textContent = 'Cancel Conversion';

  log(`Set sprite dimensions...`);

  let player = playerCanvas.player
  const listener = async () => {
    player.stop();
    player.setLoop(false);

    for (let f = 0; f < lottieDetails.newFrames; f++) {
      if (cancelled) {
        converting = false;
        break;
      }

      log(`Rendering frame #${f} from frame #${lottieDetails.frameMapping[f]}...`);
      player.setFrame(lottieDetails.frameMapping[f]);
      // await new Promise(resolve => setTimeout(() => resolve(), 1000));

      try {
        // Test: Get frame as blob URI and create img element
        await new Promise((resolve, reject) => {
          playerCanvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const img = document.createElement('img');
              img.src = url;
              img.style.width = '100px';
              img.style.height = '100px';
              img.style.border = '2px solid #ccc';
              img.style.margin = '2px';
              img.style.cursor = 'pointer';
              img.style.transition = 'border-color 0.2s ease';
              img.title = `Frame ${f} - Click to select/deselect`;
              img.className = 'sprite-frame';
              img.dataset.frame = f;
              
              // Add click handler to toggle selection
              img.addEventListener('click', () => {
                toggleFrameSelection(f);
                updateFrameVisualState(img, f);
              });
              
              // Create container for frame and download button
              const frameContainer = document.createElement('div');
              frameContainer.style.display = 'inline-block';
              frameContainer.style.margin = '2px';
              frameContainer.style.textAlign = 'center';
              
              // Create download button for this frame
              const downloadBtn = document.createElement('button');
              downloadBtn.textContent = 'Download';
              downloadBtn.style.fontSize = '10px';
              downloadBtn.style.padding = '2px 6px';
              downloadBtn.style.margin = '2px 0';
              downloadBtn.style.cursor = 'pointer';
              downloadBtn.style.border = '1px solid #ccc';
              downloadBtn.style.borderRadius = '3px';
              downloadBtn.style.backgroundColor = '#f8f9fa';
              
              // Add download functionality
              downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent frame selection when clicking download
                const spriteName = inputSpriteName.value || 'sprite';
                const link = document.createElement('a');
                link.href = url;
                link.download = `${spriteName}_${f}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              });
              
              // Add hover effects
              downloadBtn.addEventListener('mouseenter', () => {
                downloadBtn.style.backgroundColor = '#e9ecef';
              });
              downloadBtn.addEventListener('mouseleave', () => {
                downloadBtn.style.backgroundColor = '#f8f9fa';
              });
              
              // Assemble the frame container
              frameContainer.appendChild(img);
              frameContainer.appendChild(document.createElement('br'));
              frameContainer.appendChild(downloadBtn);
              
              sprites.appendChild(frameContainer);
              log(`Frame ${f}: Created blob URI and img element`);
              frameSrc[f] = url;
              resolve();
            } else {
              log(`Frame ${f}: Failed to create blob`);
              reject();
            }
          }, 'image/png');
        });
      } catch (e) {
        log(`Frame ${f} error: ${e.toString()}`)
      }
    }

    log(`Done!`);
    player.removeEventListener("load", listener);
    converting = false;
    btnConvert.textContent = 'Convert to Sprite';
    player.setLoop(true);
    player.setFrame(0);
    player.play();
    
    // Set preview dimensions
    preview.width = inputWidth.value;
    preview.height = inputHeight.value;
    
    // Initialize download button as disabled
    updateDownloadButton();
  }

  // Load into player
  player.addEventListener("load", listener);

  log(`Startng animation...`);
  btnDownload.disabled = false;
  player.load({
    autoplay: false,
    loop: false,
    src: lottieDetails.url,
  });
};

const getLottieDetails = async url => {
  const result = await fetch(url);
  const json = await result.json();

  lottieDetails = {
    url,
    height: json.h,
    width: json.w,
    frames: json.op - json.ip + 1,
    newFrames: json.op - json.ip + 1,
    frameMapping: frameMapping(json.op - json.ip + 1, json.op - json.ip + 1),
    fps: json.fr
  };
};

if (btnLoad) {
  btnLoad.addEventListener("click", async () => {
    log(`Loading ${inputLottieUrl.value}`);
    await getLottieDetails(inputLottieUrl.value);
    playerCanvas.player.load({
      autoplay: true,
      loop: true,
      src: inputLottieUrl.value,
    });

    cancelled = false;
    btnConvert.disabled = false;
    selectedFrames.clear();
    inputOWidth.value = lottieDetails.width;
    inputOHeight.value = lottieDetails.height;
    inputWidth.value = lottieDetails.width;
    inputHeight.value = lottieDetails.height;
    playerCanvas.width = lottieDetails.width;
    playerCanvas.height = lottieDetails.height;
    playerCanvas.player.resize();
    inputScale.value = 1;
    inputOFps.value = lottieDetails.fps;
    inputFps.value = lottieDetails.fps;
    inputOFrames.value = lottieDetails.frames;
    inputFrames.value = lottieDetails.frames;
    updateDownloadButton();
    
    Object.values(frameSrc).forEach(url => 
      URL.revokeObjectURL(url)
    );
    frameSrc = {};
    preview.style.display = 'none';
    if (previewInterval) {
      clearInterval(previewInterval);
      previewInterval = null;
    }
  });
}

if (inputLottieUrl) {
  inputLottieUrl.addEventListener("change", () => {
    btnConvert.disabled = lottieDetails?.url !== inputLottieUrl.value;
  });
}

if (btnConvert) {
  btnConvert.addEventListener("click", () => {
    convert();
  });
}

if (inputScale) {
  inputScale.addEventListener("change", () => {
    const newWidth = lottieDetails.width * inputScale.value;
    const newHeight = lottieDetails.height * inputScale.value;
    
    playerCanvas.width = newWidth;
    playerCanvas.height = newHeight;
    playerCanvas.player.resize();
    
    inputWidth.value = newWidth;
    inputHeight.value = newHeight;
  });
}

if (inputWidth) {
  inputWidth.addEventListener("change", () => {
    const newScale = inputWidth.value / lottieDetails.width;
    const newHeight = lottieDetails.height * newScale;
    
    inputScale.value = newScale;
    inputHeight.value = newHeight;
    
    playerCanvas.width = inputWidth.value;
    playerCanvas.height = newHeight;
    playerCanvas.player.resize();
  });
}

if (inputHeight) {
  inputHeight.addEventListener("change", () => {
    const newScale = inputHeight.value / lottieDetails.height;
    const newWidth = lottieDetails.width * newScale;
    
    inputScale.value = newScale;
    inputWidth.value = newWidth;
    
    playerCanvas.width = newWidth;
    playerCanvas.height = inputHeight.value;
    playerCanvas.player.resize();
  });
}

if (inputFps) {
  inputFps.addEventListener("change", () => {
    const duration = lottieDetails.frames / lottieDetails.fps;
    const newFrameCount = Math.floor(duration * inputFps.value);
    const newFrames = frameMapping(lottieDetails.frames, newFrameCount);
    inputFrames.value = newFrameCount;
    lottieDetails.newFrames = newFrameCount;
    lottieDetails.frameMapping = newFrames;
  });
}

if (btnDownload) {
  btnDownload.addEventListener("click", async () => {
    if (selectedFrames.size === 0) return;
    
    const zip = new JSZip();
    const selectedFramesArray = Array.from(selectedFrames).sort((a, b) => a - b);
    
    await Promise.all(selectedFramesArray.map(frameNumber => {
      const sprite = document.querySelector(`[data-frame="${frameNumber}"]`);
      if (sprite) {
        return fetch(sprite.src)
          .then(response => response.blob())
          .then(blob => {
            zip.file(`${inputSpriteName.value}_${frameNumber}.png`, blob);
          });
      }
    }));
    
    zip.generateAsync({ type: "blob" }).then(content => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${inputSpriteName.value}_selected.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });
}