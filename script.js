document.addEventListener('DOMContentLoaded', () => {
    // --- View Navigation & Slow-Motion Video ---
    const openBtn = document.getElementById('open-btn');
    const backBtn = document.getElementById('back-btn');
    const cakeBackBtn = document.getElementById('cake-back-btn');
    const landingView = document.getElementById('landing-view');
    const cakeView = document.getElementById('cake-view');
    const celebrationView = document.getElementById('celebration-view');
    const heroVideo = document.querySelector('video');
    const candlesBox = document.getElementById('cake-candles');
    const micStatus = document.getElementById('mic-status');
    const skipCakeBtn = document.getElementById('skip-cake-btn');
    const birthdayReveal = document.getElementById('birthday-reveal');
    const birthdayRevealBtn = document.getElementById('birthday-reveal-btn');
    const birthdayRevealCloseBtn = document.getElementById('birthday-reveal-close-btn');
    const confettiLayer = document.getElementById('confetti-layer');
    const confettiSound = new Audio('media/sounds/confetti.mp3');
    confettiSound.preload = 'auto';
    const balloonBlastSound = new Audio('media/sounds/balloon_blast.mp3');
    balloonBlastSound.preload = 'auto';
    balloonBlastSound.load();
    let balloonAudioContext = null;
    let balloonAudioGain = null;
    let balloonAudioSource = null;

    const CANDLE_COUNT = 20;
    const candleStates = Array(CANDLE_COUNT).fill(true);
    const candleRelights = Array(CANDLE_COUNT).fill(0);
    const candleElements = [];
    const candleMeshes = [];
    const candleExtinguishTimeouts = Array(CANDLE_COUNT).fill(0);
    let candleRenderer = null;
    let candleScene = null;
    let candleCamera = null;
    let candleAnimationFrame = 0;
    let cakeActive = false;
    let cakeFinished = false;
    let micStream = null;
    let micRequestPromise = null;
    let audioContext = null;
    let analyser = null;
    let audioSource = null;
    let listeningFrame = 0;
    let blowStartedAt = 0;
    let quietStartedAt = 0;
    let blowLatched = false;
    let noiseFloor = 0.008;
    let lastBlowAt = 0;
    let relightTimeout = 0;
    let revealTimeout = 0;
    let confettiRainInterval = 0;
    let candleFinishTimeout = 0;
    let balloonSpawnTimeout = 0;
    let specialBalloonSpawnTimeout = 0;

    document.querySelectorAll('.decoration-heart, .decoration-star').forEach(decoration => {
        const extraTwist = `${10 + Math.random() * 5}deg`;
        const extraSwing = `${1 + Math.random() * 4}deg`;
        const twistProperty = decoration.classList.contains('decoration-heart')
            ? '--heart-twist-extra'
            : '--star-twist-extra';
        const swingProperty = decoration.classList.contains('decoration-heart')
            ? '--heart-swing-extra'
            : '--star-swing-extra';
        decoration.style.setProperty(twistProperty, extraTwist);
        decoration.style.setProperty(swingProperty, extraSwing);
    });

    const decorationLayer = document.querySelector('.celebration-decorations');
    const balloonParticleColors = ['#fff36b', '#ff5ca8', '#54f1e2', '#b778ff', '#ff9b42', '#8cff79'];
    const balloonClasses = ['balloon-pink', 'balloon-gold', 'balloon-lilac', 'balloon-blue', 'balloon-rose'];
    const SPECIAL_BALLOON_Z_INDEX = 16;
    let balloonColorBatch = [];
    let lastBalloonColor = '';
    let balloonZIndexBatch = [];

    function getNextBalloonColor() {
        if (!balloonColorBatch.length) {
            balloonColorBatch = [...balloonClasses];
            for (let index = balloonColorBatch.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(Math.random() * (index + 1));
                [balloonColorBatch[index], balloonColorBatch[swapIndex]] =
                    [balloonColorBatch[swapIndex], balloonColorBatch[index]];
            }
            if (balloonColorBatch[balloonColorBatch.length - 1] === lastBalloonColor) {
                const swapIndex = Math.floor(Math.random() * (balloonColorBatch.length - 1));
                [balloonColorBatch[swapIndex], balloonColorBatch[balloonColorBatch.length - 1]] =
                    [balloonColorBatch[balloonColorBatch.length - 1], balloonColorBatch[swapIndex]];
            }
        }
        lastBalloonColor = balloonColorBatch.pop();
        return lastBalloonColor;
    }

    function getNextBalloonZIndex() {
        if (!balloonZIndexBatch.length) {
            balloonZIndexBatch = Array.from({ length: 15 }, (_, index) => index + 1);
            for (let index = balloonZIndexBatch.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(Math.random() * (index + 1));
                [balloonZIndexBatch[index], balloonZIndexBatch[swapIndex]] =
                    [balloonZIndexBatch[swapIndex], balloonZIndexBatch[index]];
            }
        }
        return balloonZIndexBatch.pop();
    }

    function getDecorationLayerWidth() {
        return decorationLayer ? decorationLayer.clientWidth : window.innerWidth;
    }

    function toDecorationLayerPercent(position) {
        return (position / getDecorationLayerWidth()) * 100;
    }

    function setBalloonBrightness(balloon, horizontalPosition) {
        const distanceFromCenter = Math.max(0, Math.min(1, Math.abs(horizontalPosition - 50) / 50));
        const brightness = 0.82 + distanceFromCenter * 0.18;
        const blur = 3 - distanceFromCenter * 1.5;
        balloon.style.setProperty('--balloon-brightness', brightness.toFixed(2));
        balloon.style.setProperty('--balloon-blur', `${blur.toFixed(2)}px`);
        return brightness;
    }

    function setBalloonSway(element) {
        const swayDuration = 9 + Math.random() * 8;
        const swayDistanceLeft = 4 + Math.random() * 4;
        const swayDistanceRight = 4 + Math.random() * 4;
        const swayTiltLeft = 1 + Math.random() * 2;
        const swayTiltRight = 1 + Math.random() * 2;
        element.style.setProperty('--balloon-sway-duration', `${swayDuration}s`);
        element.style.setProperty('--balloon-sway-delay', `${-Math.random() * swayDuration}s`);
        element.style.setProperty('--balloon-sway-left', `${-swayDistanceLeft}px`);
        element.style.setProperty('--balloon-sway-right', `${swayDistanceRight}px`);
        element.style.setProperty('--balloon-sway-tilt-left', `${-swayTiltLeft}deg`);
        element.style.setProperty('--balloon-sway-tilt-right', `${swayTiltRight}deg`);
    }

    function setClusterBalloonTilt(balloon) {
        const tiltDuration = 14 + Math.random() * 8;
        const tiltLeft = 0.8 + Math.random() * 1.2;
        const tiltRight = 0.8 + Math.random() * 1.2;
        balloon.style.setProperty('--cluster-balloon-tilt-duration', `${tiltDuration}s`);
        balloon.style.setProperty('--cluster-balloon-tilt-delay', `${-Math.random() * tiltDuration}s`);
        balloon.style.setProperty('--cluster-balloon-tilt-left', `${-tiltLeft}deg`);
        balloon.style.setProperty('--cluster-balloon-tilt-right', `${tiltRight}deg`);
    }

    function setClusterJointMotion(element, duration, delay, angleLeft, angleRight) {
        element.style.setProperty('--cluster-joint-duration', `${duration}s`);
        element.style.setProperty('--cluster-joint-delay', `${delay}s`);
        element.style.setProperty('--cluster-joint-angle-left', `${angleLeft}deg`);
        element.style.setProperty('--cluster-joint-angle-right', `${angleRight}deg`);
    }

    function chooseBalloonLeft(width, includeCenter = false, edgeOnly = false) {
        const layerWidth = getDecorationLayerWidth();
        const maxLeft = Math.max(0, layerWidth - width - 8);
        const lanes = edgeOnly ? [4, 82] : [4, 18, 68, 82];
        const lanePositions = lanes.map(percent => Math.min(maxLeft, layerWidth * percent / 100));
        if (includeCenter && Math.random() < 0.08) {
            lanePositions.push(Math.min(maxLeft, layerWidth * (40 + Math.random() * 12) / 100));
        }

        const existingRects = decorationLayer
            ? Array.from(decorationLayer.querySelectorAll('.decoration-balloon:not(.cluster-member):not(.is-popped), .balloon-cluster'))
                .map(item => item.getBoundingClientRect())
            : [];
        const candidates = lanePositions.map(left => {
            const right = left + width;
            const clearance = existingRects.length
                ? Math.min(...existingRects.map(rect => Math.max(rect.left - right, left - rect.right, 0)))
                : Infinity;
            return { left, clearance };
        });
        const bestClearance = Math.max(...candidates.map(candidate => candidate.clearance));
        const bestCandidates = candidates.filter(candidate => candidate.clearance >= bestClearance - 48);
        return bestCandidates[Math.floor(Math.random() * bestCandidates.length)].left;
    }

    function playBalloonPopSound() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            console.error('Balloon blast sound could not be amplified: Web Audio is not supported.');
            return;
        }

        try {
            if (!balloonAudioContext) {
                balloonAudioContext = new AudioContextClass();
                balloonAudioGain = balloonAudioContext.createGain();
                balloonAudioGain.gain.value = 1.5;
                balloonAudioSource = balloonAudioContext.createMediaElementSource(balloonBlastSound);
                balloonAudioSource.connect(balloonAudioGain);
                balloonAudioGain.connect(balloonAudioContext.destination);
            }
        } catch (error) {
            console.error(`Balloon blast sound could not be amplified: ${error.message || error.name}`);
            return;
        }

        balloonBlastSound.currentTime = 0;
        const playback = balloonAudioContext.state === 'suspended'
            ? balloonAudioContext.resume().then(() => balloonBlastSound.play())
            : balloonBlastSound.play();
        playback.catch(error => {
            console.error(`Balloon blast sound could not play: ${error.message || error.name}`);
        });
    }

    function popSurpriseBalloon(balloon) {
        if (balloon.classList.contains('is-popped') || !decorationLayer) return;
        balloon.classList.add('is-popped');
        playBalloonPopSound();

        const balloonRect = balloon.getBoundingClientRect();
        const layerRect = decorationLayer.getBoundingClientRect();
        const balloonZIndex = getComputedStyle(balloon).zIndex;
        const particleCount = 240;
        const centerX = balloonRect.left + balloonRect.width / 2 - layerRect.left;
        const centerY = balloonRect.top + balloonRect.height / 2 - layerRect.top;
        const maximumBurstY = Math.max(0, layerRect.height - centerY - 8);
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 1.5;
            const burstX = Math.cos(angle) * radius * balloonRect.width;
            const burstY = Math.max(
                -centerY + 8,
                Math.min(maximumBurstY, Math.sin(angle) * radius * balloonRect.height)
            );
            const particle = document.createElement('span');
            particle.className = 'balloon-particle';
            particle.style.zIndex = balloonZIndex;
            particle.style.setProperty('--particle-x', `${centerX}px`);
            particle.style.setProperty('--particle-y', `${centerY}px`);
            particle.style.setProperty('--particle-burst-x', `${burstX}px`);
            particle.style.setProperty('--particle-burst-y', `${burstY}px`);
            particle.style.setProperty('--particle-fall-y', `${Math.max(0, layerRect.height - centerY - burstY + 24)}px`);
            particle.style.setProperty('--particle-width', `${5 + Math.random() * 5}px`);
            particle.style.setProperty('--particle-height', `${8 + Math.random() * 8}px`);
            particle.style.setProperty('--particle-rotation', `${Math.random() * 180}deg`);
            particle.style.setProperty('--particle-duration', `${2.4 + Math.random() * 1.6}s`);
            particle.style.setProperty('--particle-color', balloonParticleColors[Math.floor(Math.random() * balloonParticleColors.length)]);
            particle.addEventListener('animationend', () => particle.remove(), { once: true });
            decorationLayer.appendChild(particle);
        }
    }

    if (decorationLayer) {
        decorationLayer.addEventListener('click', event => {
            if (event.target instanceof Element) {
                const balloon = event.target.closest('.special-balloon');
                if (balloon) popSurpriseBalloon(balloon);
            }
        });
    }

    function createBalloon(isSpecial, duration) {
        const balloon = document.createElement(isSpecial ? 'button' : 'span');
        balloon.classList.add('decoration-balloon', getNextBalloonColor());
        balloon.style.setProperty('--balloon-duration', `${duration}s`);
        if (isSpecial) {
            balloon.classList.add('special-balloon');
            balloon.type = 'button';
            balloon.setAttribute('aria-label', 'Pop a surprise balloon');
            for (let i = 0; i < 22; i++) {
                const particle = document.createElement('span');
                particle.className = 'balloon-fill-particle';
                particle.style.setProperty('--fill-x', `${22 + Math.random() * 56}%`);
                particle.style.setProperty('--fill-y', `${15 + Math.random() * 62}%`);
                particle.style.setProperty('--fill-width', `${3 + Math.random() * 3}px`);
                particle.style.setProperty('--fill-height', `${5 + Math.random() * 4}px`);
                particle.style.setProperty('--fill-color', balloonParticleColors[Math.floor(Math.random() * balloonParticleColors.length)]);
                particle.style.setProperty('--fill-delay', `${Math.random() * 2}s`);
                particle.style.setProperty('--fill-rotation', `${Math.random() * 180}deg`);
                balloon.appendChild(particle);
            }
        } else {
            balloon.setAttribute('aria-hidden', 'true');
        }
        return balloon;
    }

    function spawnBalloonCluster() {
        const count = 2;
        const cluster = document.createElement('div');
        const duration = 29 + Math.random() * 4;
        cluster.className = 'balloon-cluster';
        cluster.style.setProperty('--balloon-duration', `${duration}s`);
        setBalloonSway(cluster);
        const tailHeight = 60 + Math.random() * 35;
        cluster.style.setProperty('--cluster-tail-height', `${tailHeight}px`);
        const balloonSizes = [];
        let clusterZIndex = 0;

        for (let i = 0; i < count; i++) {
            const balloon = createBalloon(false, duration);
            const member = document.createElement('div');
            const size = 0.78 + Math.random() * 0.42;
            const baseWidth = Math.min(82, Math.max(48, window.innerWidth * 0.06));
            const baseHeight = Math.min(104, Math.max(62, window.innerWidth * 0.08));
            member.classList.add('cluster-member');
            member.style.setProperty('--cluster-width', `${baseWidth * size}px`);
            member.style.setProperty('--cluster-height', `${baseHeight * size}px`);
            member.style.setProperty('--cluster-lift', `${Math.random() * 18 - 9}px`);
            const jointDuration = 14 + Math.random() * 8;
            const jointDelay = -Math.random() * jointDuration;
            const jointAngle = 2 + Math.random() * 3;
            setClusterJointMotion(member, jointDuration, jointDelay, -jointAngle, jointAngle);
            const zIndex = getNextBalloonZIndex();
            member.style.zIndex = `${zIndex}`;
            clusterZIndex = Math.max(clusterZIndex, zIndex);
            setClusterBalloonTilt(balloon);
            member.appendChild(balloon);
            cluster.appendChild(member);
            balloonSizes.push({
                width: baseWidth * size,
                height: baseHeight * size
            });
        }

        const overlap = 42;
        const secondX = balloonSizes[0].width - overlap;
        const clusterWidth = secondX + balloonSizes[1].width;
        const clusterBalloonHeight = Math.max(balloonSizes[0].height, balloonSizes[1].height);
        cluster.querySelectorAll('.cluster-member').forEach((balloon, index) => {
            balloon.style.setProperty('--cluster-x', `${index === 0 ? 0 : secondX}px`);
            balloon.style.setProperty('--cluster-y', '0px');
        });
        cluster.style.setProperty('--cluster-width', `${clusterWidth}px`);
        cluster.style.setProperty('--cluster-balloon-area-height', `${clusterBalloonHeight}px`);
        cluster.style.zIndex = `${clusterZIndex}`;

        const clusterLeft = chooseBalloonLeft(clusterWidth, true);
        cluster.style.setProperty('--cluster-left', `${toDecorationLayerPercent(clusterLeft)}%`);
        cluster.querySelectorAll('.cluster-member').forEach((balloon, index) => {
            const balloonX = parseFloat(balloon.style.getPropertyValue('--cluster-x'));
            const balloonCenter = clusterLeft + balloonX + balloonSizes[index].width / 2;
            setBalloonBrightness(balloon.firstElementChild, toDecorationLayerPercent(balloonCenter));
        });

        cluster.addEventListener('animationend', () => cluster.remove(), { once: true });
        decorationLayer.appendChild(cluster);
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const stringSvg = document.createElementNS(svgNamespace, 'svg');
        const svgWidth = cluster.offsetWidth;
        const svgHeight = cluster.offsetHeight;
        const members = Array.from(cluster.querySelectorAll('.cluster-member'));
        const getBalloonKnot = member => {
            const balloon = member.firstElementChild;
            const [originX, originY] = getComputedStyle(balloon).transformOrigin.split(' ').map(parseFloat);
            const lift = parseFloat(member.style.getPropertyValue('--cluster-lift'));
            return {
                x: member.offsetLeft + balloon.offsetLeft + originX,
                y: member.offsetTop + balloon.offsetTop + originY + lift
            };
        };
        const centers = members.map(balloon => {
            const body = balloon.firstElementChild;
            const lift = parseFloat(balloon.style.getPropertyValue('--cluster-lift'));
            return {
                x: balloon.offsetLeft + body.offsetLeft + body.offsetWidth / 2,
                y: balloon.offsetTop + body.offsetTop + body.offsetHeight / 2 + lift
            };
        });
        let bottomAnchors = members.map(getBalloonKnot);
        let knotX = bottomAnchors.reduce((sum, anchor) => sum + anchor.x, 0) / count;
        let knotY = Math.max(...bottomAnchors.map(anchor => anchor.y)) + 12;
        const partnerTilts = members.map(() => (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3));
        members.forEach((member, index) => {
            const center = centers[index];
            const angle = Math.atan2(center.x - knotX, knotY - center.y) + partnerTilts[index] * Math.PI / 180;
            member.style.setProperty('--tie-angle', `${angle * 180 / Math.PI}deg`);
        });
        members.forEach(member => {
            member.style.setProperty('--cluster-joint-pivot-x', `${knotX - member.offsetLeft}px`);
            member.style.setProperty('--cluster-joint-pivot-y', `${knotY - member.offsetTop}px`);
        });
        stringSvg.classList.add('balloon-cluster-strings');
        stringSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        stringSvg.setAttribute('aria-hidden', 'true');
        stringSvg.style.setProperty('--cluster-knot-x', `${knotX}px`);
        stringSvg.style.setProperty('--cluster-knot-y', `${knotY}px`);

        bottomAnchors.forEach((anchor, index) => {
            const member = members[index];
            const connectorSvg = document.createElementNS(svgNamespace, 'svg');
            connectorSvg.classList.add('balloon-cluster-member-string');
            connectorSvg.setAttribute('viewBox', `0 0 ${member.offsetWidth} ${member.offsetHeight}`);
            connectorSvg.setAttribute('aria-hidden', 'true');
            const line = document.createElementNS(svgNamespace, 'path');
            line.setAttribute(
                'd',
                `M ${anchor.x - member.offsetLeft} ${anchor.y - member.offsetTop} L ${knotX - member.offsetLeft} ${knotY - member.offsetTop}`
            );
            line.classList.add('balloon-cluster-tie');
            line.style.setProperty(
                '--cluster-string-color',
                getComputedStyle(member.firstElementChild).getPropertyValue('--balloon-mid')
            );
            connectorSvg.appendChild(line);
            member.prepend(connectorSvg);
        });

        const tailLength = parseFloat(cluster.style.getPropertyValue('--cluster-tail-height'));
        const tailGroup = document.createElementNS(svgNamespace, 'g');
        tailGroup.classList.add('balloon-cluster-tail-group');
        tailGroup.style.transformOrigin = `${knotX}px ${knotY}px`;
        members.forEach((_, index) => {
            const tail = document.createElementNS(svgNamespace, 'path');
            const individualTailLength = tailLength * (0.55 + Math.random() * 0.45);
            const offset = (index - (count - 1) / 2) * 5;
            const sway = (Math.random() * 2 - 1) * 5;
            tail.setAttribute(
                'd',
                `M ${knotX} ${knotY} C ${knotX + sway} ${knotY + individualTailLength * 0.28}, ${knotX + offset - sway} ${knotY + individualTailLength * 0.68}, ${knotX + offset} ${knotY + individualTailLength}`
            );
            tail.classList.add('balloon-cluster-tail');
            tail.style.setProperty(
                '--cluster-string-color',
                getComputedStyle(members[index].firstElementChild).getPropertyValue('--balloon-mid')
            );
            tailGroup.appendChild(tail);
        });
        stringSvg.appendChild(tailGroup);

        const knot = document.createElementNS(svgNamespace, 'path');
        const knotPoints = Array.from({ length: 7 }, (_, index) => {
            const angle = (index / 7) * Math.PI * 2;
            const radius = 2.5 + Math.random() * 2;
            return `${knotX + Math.cos(angle) * radius} ${knotY + Math.sin(angle) * radius}`;
        });
        knot.setAttribute('d', `M ${knotPoints.join(' L ')} Z`);
        knot.classList.add('balloon-cluster-knot');
        stringSvg.appendChild(knot);
        cluster.prepend(stringSvg);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            cluster.style.top = `${15 + Math.random() * 70}%`;
            cluster.style.bottom = 'auto';
            window.setTimeout(() => cluster.remove(), 28000);
        }
    }

    function spawnBalloon(isSpecial = false) {
        if (!decorationLayer) return;
        if (!isSpecial && Math.random() < 0.45) {
            spawnBalloonCluster();
            return;
        }

        const duration = 19 + Math.random() * 3;
        const balloon = createBalloon(isSpecial, duration);
        setBalloonSway(balloon);
        balloon.style.zIndex = `${isSpecial ? SPECIAL_BALLOON_Z_INDEX : getNextBalloonZIndex()}`;
        const balloonLeft = isSpecial
            ? chooseBalloonLeft(Math.min(82, Math.max(48, window.innerWidth * 0.06)), false, true)
            : chooseBalloonLeft(Math.min(82, Math.max(48, window.innerWidth * 0.06)), true);
        const horizontalPosition = toDecorationLayerPercent(balloonLeft);
        balloon.style.setProperty('--balloon-left', `${horizontalPosition}%`);
        setBalloonBrightness(balloon, horizontalPosition);

        balloon.addEventListener('animationend', () => balloon.remove(), { once: true });
        decorationLayer.appendChild(balloon);

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            balloon.style.top = `${15 + Math.random() * 70}%`;
            balloon.style.bottom = 'auto';
            window.setTimeout(() => balloon.remove(), 28000);
        }
    }

    function startBalloonStream() {
        if (!decorationLayer || balloonSpawnTimeout) return;
        const spawnNextBalloon = () => {
            spawnBalloon(false);
            balloonSpawnTimeout = window.setTimeout(spawnNextBalloon, 4500 + Math.random() * 2000);
        };
        spawnNextBalloon();
        const spawnNextSpecialBalloon = () => {
            specialBalloonSpawnTimeout = window.setTimeout(() => {
                specialBalloonSpawnTimeout = 0;
                if (!celebrationView.classList.contains('active')) return;
                spawnBalloon(true);
                spawnNextSpecialBalloon();
            }, 10000 + Math.random() * 3000);
        };
        spawnNextSpecialBalloon();
    }

    function stopBalloonStream() {
        if (balloonSpawnTimeout) window.clearTimeout(balloonSpawnTimeout);
        if (specialBalloonSpawnTimeout) window.clearTimeout(specialBalloonSpawnTimeout);
        balloonSpawnTimeout = 0;
        specialBalloonSpawnTimeout = 0;
    }

    if (candlesBox) {
        for (let i = 0; i < CANDLE_COUNT; i++) {
            const candle = document.createElement('div');
            candle.className = 'cake-candle';
            const row = Math.floor(i / 5);
            const column = i % 5;
            const x = 38 + column * 6 + (row % 2) * (column < 2 ? 2 : column > 2 ? -2 : 0);
            const baseY = 27 + row * 2.3 + Math.pow((column - 2) / 2, 2) * 0.7;
            const length = 20 + Math.floor(Math.random() * 11);
            candle.style.setProperty('--candle-x', `${x}%`);
            candle.style.setProperty('--candle-y', `${baseY}%`);
            candle.style.setProperty('--candle-row', `${row}`);
            candle.style.setProperty('--candle-height', `${length}px`);
            candle.style.setProperty('--candle-tilt', `${(column % 3 - 1) * 2}deg`);
            candle.style.setProperty('--candle-delay', `${(i % 5) * -0.13}s`);
            candle.style.setProperty('--flame-duration', `${1.1 + (i % 4) * 0.16}s`);
            candle.style.setProperty('--candle-color', ['#f5c46b', '#f38c9d', '#a8d7e8', '#c4a7e7'][i % 4]);
            candle.innerHTML = '<span class="candle-flame"></span>';
            candlesBox.appendChild(candle);
            candleElements.push(candle);
        }
    }

    function updateCandles() {
        candleElements.forEach((candle, index) => {
            const mesh = candleMeshes[index];
            const isExtinguishing = Boolean(candleExtinguishTimeouts[index] || (mesh && mesh.userData.extinguishing));
            candle.classList.toggle('is-out', !candleStates[index] && !isExtinguishing);
            candle.classList.toggle('is-blowing-out', isExtinguishing);
            if (mesh) {
                if (candleStates[index]) mesh.userData.lit = true;
                else if (!isExtinguishing) mesh.userData.lit = false;
                const flameVisible = candleStates[index] || isExtinguishing;
                mesh.userData.flame.visible = flameVisible;
                mesh.userData.innerFlame.visible = flameVisible;
                mesh.userData.glow.visible = flameVisible;
                mesh.userData.flameLight.visible = flameVisible;
            }
        });
        renderCandleScene();
    }

    function extinguishCandle(index) {
        const candle = candleElements[index];
        const mesh = candleMeshes[index];
        if (candleExtinguishTimeouts[index]) window.clearTimeout(candleExtinguishTimeouts[index]);
        if (mesh) {
            mesh.userData.extinguishing = true;
            mesh.userData.extinguishStartedAt = performance.now();
            mesh.userData.lit = true;
        }
        if (candle) {
            candle.classList.remove('is-out');
            candle.classList.add('is-blowing-out');
        }

        candleExtinguishTimeouts[index] = window.setTimeout(() => {
            candleExtinguishTimeouts[index] = 0;
            if (mesh) {
                mesh.userData.extinguishing = false;
                mesh.userData.lit = false;
                mesh.userData.flame.visible = false;
                mesh.userData.innerFlame.visible = false;
                mesh.userData.glow.visible = false;
                mesh.userData.flameLight.visible = false;
            }
            if (candle) {
                candle.classList.remove('is-blowing-out');
                candle.classList.add('is-out');
            }
            renderCandleScene();
        }, 460);
    }

    function initializeCandleScene() {
        if (!candlesBox || candleRenderer) return;
        const THREE = window.THREE;
        if (!THREE) {
            console.error('Three.js did not load; using the animated candle fallback.');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'cake-candles-3d';
        candlesBox.appendChild(canvas);
        candlesBox.classList.add('has-3d-candles');

        candleScene = new THREE.Scene();
        candleCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
        candleCamera.position.set(0, 0, 30);
        candleScene.add(new THREE.AmbientLight(0xffffff, 1.35));
        const keyLight = new THREE.DirectionalLight(0xffe6c1, 1.5);
        keyLight.position.set(-3, 5, 8);
        candleScene.add(keyLight);

        candleRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        candleRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        candleRenderer.setClearColor(0x000000, 0);
        candleRenderer.outputEncoding = THREE.sRGBEncoding;

        const candleColors = ['#e83e70', '#f8b82f', '#20a9ac', '#8250d6', '#f25f34', '#4a9e4f', '#df42a6', '#258bd5'];
        const flameProfile = [
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0.035, 0.045),
            new THREE.Vector2(0.075, 0.13),
            new THREE.Vector2(0.084, 0.23),
            new THREE.Vector2(0.062, 0.34),
            new THREE.Vector2(0.03, 0.44),
            new THREE.Vector2(0, 0.5)
        ];
        const flameGeometry = new THREE.LatheGeometry(flameProfile, 16);
        const flameColors = [];
        for (let i = 0; i < flameGeometry.attributes.position.count; i++) {
            const height = flameGeometry.attributes.position.getY(i) / 0.5;
            const color = height < 0.55
                ? new THREE.Color('#ff4a19').lerp(new THREE.Color('#ffb31f'), height / 0.55)
                : new THREE.Color('#ffb31f').lerp(new THREE.Color('#fff7b2'), (height - 0.55) / 0.45);
            flameColors.push(color.r, color.g, color.b);
        }
        flameGeometry.setAttribute('color', new THREE.Float32BufferAttribute(flameColors, 3));

        const innerFlameGeometry = new THREE.LatheGeometry(flameProfile, 12);
        const innerFlameColors = [];
        for (let i = 0; i < innerFlameGeometry.attributes.position.count; i++) {
            const color = new THREE.Color('#fff5b4').lerp(
                new THREE.Color('#fffef2'),
                innerFlameGeometry.attributes.position.getY(i) / 0.5
            );
            innerFlameColors.push(color.r, color.g, color.b);
        }
        innerFlameGeometry.setAttribute('color', new THREE.Float32BufferAttribute(innerFlameColors, 3));

        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 64;
        glowCanvas.height = 64;
        const glowContext = glowCanvas.getContext('2d');
        const glowGradient = glowContext.createRadialGradient(32, 32, 1, 32, 32, 32);
        glowGradient.addColorStop(0, 'rgba(255, 246, 190, 0.95)');
        glowGradient.addColorStop(0.2, 'rgba(255, 177, 52, 0.55)');
        glowGradient.addColorStop(1, 'rgba(255, 130, 28, 0)');
        glowContext.fillStyle = glowGradient;
        glowContext.fillRect(0, 0, 64, 64);
        const glowTexture = new THREE.CanvasTexture(glowCanvas);

        const resizeCandleScene = () => {
            const { width, height } = candlesBox.getBoundingClientRect();
            if (!width || !height) return;
            const worldHeight = 10 * height / width;
            candleCamera.left = -5;
            candleCamera.right = 5;
            candleCamera.top = worldHeight / 2;
            candleCamera.bottom = -worldHeight / 2;
            candleCamera.updateProjectionMatrix();
            candleRenderer.setSize(width, height, false);
        };
        resizeCandleScene();
        if ('ResizeObserver' in window) {
            new ResizeObserver(resizeCandleScene).observe(candlesBox);
        } else {
            window.addEventListener('resize', resizeCandleScene);
        }

        const candleLayout = [
            { x: 50, y: 38.5, height: 1.18, radius: 0.116 },
            ...Array.from({ length: 8 }, (_, index) => {
                const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
                return {
                    x: 50 + Math.cos(angle) * 6.5,
                    y: 39 + Math.sin(angle) * 3.2,
                    height: 0.82 + Math.random() * 0.06,
                    radius: 0.058
                };
            }),
            ...Array.from({ length: 11 }, (_, index) => {
                const angle = (index / 11) * Math.PI * 2 - Math.PI / 2;
                return {
                    x: 50 + Math.cos(angle) * 11,
                    y: 39.5 + Math.sin(angle) * 5.5,
                    height: 0.55 + Math.random() * 0.06,
                    radius: 0.058
                };
            })
        ];

        candleLayout.forEach(({ x, y, height: candleHeight, radius: candleRadius }, i) => {
            const xPercent = x;
            const yPercent = y;
            const width = candlesBox.clientWidth || 560;
            const height = candlesBox.clientHeight || 360;
            const worldHeight = 10 * height / width;
            const color = candleColors[(i * 3) % candleColors.length];
            const group = new THREE.Group();
            group.position.set(
                (xPercent / 100 - 0.5) * 10,
                (0.5 - yPercent / 100) * worldHeight,
                (yPercent - 40) * 0.025
            );

            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(candleRadius * 0.84, candleRadius, candleHeight, 16),
                new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.03 })
            );
            body.position.y = candleHeight / 2;
            group.add(body);

            const stripePoints = [];
            const turns = 4;
            for (let step = 0; step <= 48; step++) {
                const progress = step / 48;
                const angleOnCandle = progress * turns * Math.PI * 2;
                stripePoints.push(new THREE.Vector3(
                    Math.cos(angleOnCandle) * candleRadius * 0.92,
                    0.08 + progress * (candleHeight - 0.13),
                    Math.sin(angleOnCandle) * candleRadius * 0.92
                ));
            }
            const stripeCurve = new THREE.CatmullRomCurve3(stripePoints);
            const stripe = new THREE.Mesh(
                new THREE.TubeGeometry(stripeCurve, 96, 0.012, 5, false),
                new THREE.MeshStandardMaterial({ color: '#fff1db', roughness: 0.3, metalness: 0.08 })
            );
            group.add(stripe);

            const wick = new THREE.Mesh(
                new THREE.CylinderGeometry(0.008, 0.008, 0.075, 6),
                new THREE.MeshStandardMaterial({ color: '#352b2a', roughness: 1 })
            );
            wick.position.y = candleHeight + 0.025;
            group.add(wick);

            const flame = new THREE.Mesh(
                flameGeometry,
                new THREE.MeshBasicMaterial({ vertexColors: true })
            );
            flame.position.y = candleHeight + 0.055;
            group.add(flame);

            const innerFlame = new THREE.Mesh(
                innerFlameGeometry,
                new THREE.MeshBasicMaterial({ vertexColors: true })
            );
            innerFlame.position.set(0, candleHeight + 0.055, 0.025);
            innerFlame.scale.set(0.48, 0.72, 0.48);
            group.add(innerFlame);

            const glow = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: glowTexture,
                    color: '#ffbd55',
                    transparent: true,
                    opacity: 0.85,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                })
            );
            glow.position.y = candleHeight + 0.24;
            glow.scale.set(0.52, 0.72, 1);
            group.add(glow);

            const flameLight = new THREE.PointLight('#ffad43', 0.42, 1.8);
            flameLight.position.y = candleHeight + 0.2;
            group.add(flameLight);
            const initialFlicker = Math.random() * 0.5 - 0.25;
            group.userData = {
                flame,
                innerFlame,
                glow,
                flameLight,
                lit: true,
                phase: Math.random() * Math.PI * 2,
                flickerFrom: initialFlicker,
                flickerTo: Math.random() * 2 - 1,
                flickerStartedAt: performance.now(),
                flickerDuration: 140 + Math.random() * 260
            };
            candleMeshes.push(group);
            candleScene.add(group);
        });

        renderCandleScene();
    }

    function renderCandleScene() {
        if (!candleRenderer || !candleScene || !candleCamera) return;
        if (candleAnimationFrame) cancelAnimationFrame(candleAnimationFrame);
        const render = (time) => {
            candleAnimationFrame = 0;
            if (!cakeActive) {
                candleRenderer.render(candleScene, candleCamera);
                return;
            }
            candleMeshes.forEach(group => {
                if (!group.userData.lit) return;
                if (group.userData.extinguishing) {
                    const progress = Math.min(1, (time - group.userData.extinguishStartedAt) / 460);
                    const sputter = Math.sin(time * 0.075 + group.userData.phase) * 0.5 + 0.5;
                    group.userData.flame.scale.set(
                        0.62 + sputter * 0.5,
                        0.55 + sputter * 0.7,
                        1
                    );
                    group.userData.flame.rotation.z = Math.sin(time * 0.06 + group.userData.phase) * 0.3;
                    group.userData.innerFlame.scale.y = 0.72 * (1 - progress);
                    group.userData.glow.material.opacity = (1 - progress) * (0.25 + sputter * 0.55);
                    group.userData.flameLight.intensity = (1 - progress) * (0.2 + sputter * 0.35);
                    return;
                }
                const data = group.userData;
                if (time - data.flickerStartedAt >= data.flickerDuration) {
                    data.flickerFrom = data.flickerTo;
                    data.flickerTo = Math.random() * 2 - 1;
                    data.flickerStartedAt = time;
                    data.flickerDuration = 140 + Math.random() * 260;
                }
                const progress = Math.min(1, (time - data.flickerStartedAt) / data.flickerDuration);
                const easedProgress = progress * progress * (3 - 2 * progress);
                const flicker = data.flickerFrom + (data.flickerTo - data.flickerFrom) * easedProgress;
                data.flame.scale.set(1 + flicker * 0.045, 1 + flicker * 0.065, 1);
                data.flame.rotation.z = flicker * 0.055;
                data.flame.position.x = flicker * 0.016;
                data.innerFlame.scale.y = 0.72 + flicker * 0.028;
                data.glow.material.opacity = 0.8 + flicker * 0.1;
                data.flameLight.intensity = 0.39 + flicker * 0.075;
            });
            candleRenderer.render(candleScene, candleCamera);
            candleAnimationFrame = requestAnimationFrame(render);
        };
        candleAnimationFrame = requestAnimationFrame(render);
    }

    function setMicStatus(message) {
        if (micStatus) micStatus.textContent = message;
    }

    function stopMicrophone() {
        const hadStream = Boolean(micStream);
        if (listeningFrame) cancelAnimationFrame(listeningFrame);
        listeningFrame = 0;
        if (micStream) micStream.getTracks().forEach(track => track.stop());
        micStream = null;
        if (hadStream) micRequestPromise = null;
        if (audioSource) audioSource.disconnect();
        audioSource = null;
        analyser = null;
        if (audioContext && audioContext.state !== 'closed') audioContext.close();
        audioContext = null;
        blowStartedAt = 0;
        quietStartedAt = 0;
        blowLatched = false;
    }

    function requestMicrophone() {
        if (micRequestPromise) return micRequestPromise;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setMicStatus('Microphone access is not available here. Choose Skip to continue.');
            return Promise.resolve(null);
        }
        if (!window.isSecureContext) {
            setMicStatus('Microphone access needs HTTPS or localhost. Choose Skip to continue.');
            return Promise.resolve(null);
        }

        setMicStatus('Please allow microphone access so you can blow out the candles.');
        const request = navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            video: false
        }).then(stream => {
            if (cakeFinished) {
                stream.getTracks().forEach(track => track.stop());
                if (micRequestPromise === request) micRequestPromise = null;
                return null;
            }
            if (!cakeActive) {
                stream.getTracks().forEach(track => track.stop());
                if (micRequestPromise === request) micRequestPromise = null;
                setMicStatus('Microphone permission is ready. It will only be active during the cake surprise.');
                return null;
            }
            micStream = stream;
            setMicStatus('Microphone ready — blow steadily toward the microphone!');
            startBlowDetection();
            return stream;
        }).catch(error => {
            if (micRequestPromise === request) micRequestPromise = null;
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setMicStatus('Microphone permission was denied. Choose Skip to continue.');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                setMicStatus('No microphone was found. Choose Skip to continue.');
            } else {
                setMicStatus(`Could not start the microphone: ${error.message || error.name}. Choose Skip to continue.`);
            }
            return null;
        });
        micRequestPromise = request;
        return request;
    }

    function startBlowDetection() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!cakeActive || !micStream) return;
        if (!AudioContextClass) {
            setMicStatus('Audio detection is not supported in this browser. Choose Skip to continue.');
            return;
        }

        if (!audioContext) {
            try {
                audioContext = new AudioContextClass();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0.25;
                audioSource = audioContext.createMediaStreamSource(micStream);
                audioSource.connect(analyser);
            } catch (error) {
                setMicStatus(`Could not prepare audio detection: ${error.message || error.name}. Choose Skip to continue.`);
                return;
            }
        }

        audioContext.resume().then(() => {
            if (!cakeActive || !analyser || listeningFrame) return;
            const samples = new Float32Array(analyser.fftSize);
            const spectrum = new Float32Array(analyser.frequencyBinCount);
            const calibrationStartedAt = performance.now();
            let listeningAnnounced = false;
            let peakBlowVolume = 0;
            let lastBreathLikeAt = 0;
            noiseFloor = 0.008;
            setMicStatus('Calibrating microphone — stay quiet for a moment…');
            const detect = now => {
                if (!cakeActive || !analyser) {
                    listeningFrame = 0;
                    return;
                }

                analyser.getFloatTimeDomainData(samples);
                analyser.getFloatFrequencyData(spectrum);
                let sumSquares = 0;
                for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
                const volume = Math.sqrt(sumSquares / samples.length);
                const binWidth = audioContext.sampleRate / analyser.fftSize;
                const bandStart = Math.max(1, Math.floor(350 / binWidth));
                const bandEnd = Math.min(spectrum.length - 1, Math.ceil(6000 / binWidth));
                const totalStart = Math.max(1, Math.floor(80 / binWidth));
                const totalEnd = Math.min(spectrum.length - 1, Math.ceil(8000 / binWidth));
                let bandEnergy = 0;
                let totalEnergy = 0;
                let logBandEnergy = 0;
                for (let i = totalStart; i <= totalEnd; i++) {
                    const energy = Math.pow(10, spectrum[i] / 10);
                    totalEnergy += energy;
                    if (i >= bandStart && i <= bandEnd) {
                        const safeEnergy = Math.max(energy, 1e-12);
                        bandEnergy += energy;
                        logBandEnergy += Math.log(safeEnergy);
                    }
                }
                const bandBins = bandEnd - bandStart + 1;
                const spectralFlatness = bandBins > 0
                    ? Math.exp(logBandEnergy / bandBins) / (bandEnergy / bandBins || 1)
                    : 0;
                const breathLike = bandEnergy / (totalEnergy || 1) > 0.12 && spectralFlatness > 0.04;
                if (now - calibrationStartedAt < 1200) {
                    if (volume < 0.1) noiseFloor = noiseFloor * 0.9 + volume * 0.1;
                    listeningFrame = requestAnimationFrame(detect);
                    return;
                }
                if (!listeningAnnounced) {
                    listeningAnnounced = true;
                    setMicStatus('Microphone is listening — give the candles a steady fffuuuu!');
                }

                const threshold = Math.min(0.1, Math.max(0.02, noiseFloor * 2.2));
                if (volume < threshold * 0.7 && !blowLatched) noiseFloor = noiseFloor * 0.98 + volume * 0.02;

                if (volume >= threshold && breathLike) {
                    quietStartedAt = 0;
                    if (!blowStartedAt || now - lastBreathLikeAt > 90) {
                        blowStartedAt = now;
                        peakBlowVolume = 0;
                    }
                    lastBreathLikeAt = now;
                    peakBlowVolume = Math.max(peakBlowVolume, volume);
                    if (!blowLatched && now - blowStartedAt >= 220 && now - lastBlowAt > 750) {
                        blowLatched = true;
                        lastBlowAt = now;
                        countBlow(peakBlowVolume / threshold);
                    }
                } else {
                    if (!blowLatched && now - lastBreathLikeAt > 90) {
                        blowStartedAt = 0;
                        peakBlowVolume = 0;
                    }
                    if (blowLatched) {
                        if (volume < threshold * 0.7 && !quietStartedAt) quietStartedAt = now;
                        if (quietStartedAt && now - quietStartedAt > 180) {
                            blowLatched = false;
                            quietStartedAt = 0;
                        }
                    }
                }
                listeningFrame = requestAnimationFrame(detect);
            };
            listeningFrame = requestAnimationFrame(detect);
        }).catch(error => {
            setMicStatus(`Could not start audio detection: ${error.message || error.name}. Choose Skip to continue.`);
        });
    }

    function burstConfetti() {
        if (!confettiLayer) return;
        confettiLayer.replaceChildren();
        const colors = ['#d4af37', '#f38c9d', '#a8d7e8', '#c4a7e7', '#fff1c1', '#ff7b54'];
        for (let i = 0; i < 100; i++) {
            const piece = document.createElement('span');
            piece.className = 'confetti-piece';
            const fromLeft = i < 50;
            const startY = 48 + Math.random() * 35;
            const targetX = 8 + Math.random() * 84;
            const startX = fromLeft ? -3 + Math.random() * 4 : 99 + Math.random() * 4;
            const endX = Math.max(2, Math.min(98, targetX + Math.random() * 18 - 9));
            piece.style.setProperty('--confetti-x', `${startX}%`);
            piece.style.setProperty('--confetti-y', `${startY}%`);
            const burstX = targetX - startX;
            const burstY = -8 - Math.random() * 16;
            const fallX = endX - targetX;
            const fallDistance = 95 + Math.random() * 35;
            const spin = Math.random() * 500 - 250;
            const spinEnd = Math.random() * 900 - 450;
            piece.style.setProperty('--confetti-burst-x', `${burstX}vw`);
            piece.style.setProperty('--confetti-burst-y', `${burstY}vh`);
            piece.style.setProperty('--confetti-mid-x', `${burstX + fallX * (24 / 84)}vw`);
            piece.style.setProperty('--confetti-mid-y', `${burstY + fallDistance * (24 / 84) ** 2}vh`);
            piece.style.setProperty('--confetti-late-x', `${burstX + fallX * (52 / 84)}vw`);
            piece.style.setProperty('--confetti-late-y', `${burstY + fallDistance * (52 / 84) ** 2}vh`);
            piece.style.setProperty('--confetti-spin', `${spin}deg`);
            piece.style.setProperty('--confetti-mid-spin', `${spin + (spinEnd - spin) * (24 / 84)}deg`);
            piece.style.setProperty('--confetti-late-spin', `${spin + (spinEnd - spin) * (52 / 84)}deg`);
            piece.style.setProperty('--confetti-fall-x', `${fallX}vw`);
            piece.style.setProperty('--confetti-fall-distance', `${fallDistance}vh`);
            piece.style.setProperty('--confetti-wobble', `${Math.random() * 12 - 6}vw`);
            piece.style.setProperty('--confetti-spin-end', `${spinEnd}deg`);
            piece.style.setProperty('--confetti-spin-end', `${spinEnd}deg`);
            piece.style.setProperty('--confetti-delay', '0s');
            piece.style.setProperty('--confetti-color', colors[Math.floor(Math.random() * colors.length)]);
            piece.addEventListener('animationend', () => piece.remove(), { once: true });
            confettiLayer.appendChild(piece);
        }
    }

    function addRainConfetti() {
        if (!confettiLayer) return;
        const colors = ['#d4af37', '#f38c9d', '#a8d7e8', '#c4a7e7', '#fff1c1', '#ff7b54'];
        const piece = document.createElement('span');
        piece.className = 'confetti-piece confetti-piece-rain';
        piece.style.setProperty('--confetti-x', `${Math.random() * 100}%`);
        piece.style.setProperty('--confetti-drift-end', `${Math.random() * 180 - 90}px`);
        piece.style.setProperty('--confetti-spin-end', `${Math.random() * 900 - 450}deg`);
        piece.style.setProperty('--confetti-color', colors[Math.floor(Math.random() * colors.length)]);
        piece.addEventListener('animationend', () => piece.remove(), { once: true });
        confettiLayer.appendChild(piece);
    }

    function startConfettiRain() {
        if (!confettiLayer || confettiRainInterval) return;
        for (let i = 0; i < 12; i++) addRainConfetti();
        confettiRainInterval = window.setInterval(addRainConfetti, 180);
    }

    function stopConfettiRain() {
        if (confettiRainInterval) window.clearInterval(confettiRainInterval);
        confettiRainInterval = 0;
        if (confettiLayer) confettiLayer.replaceChildren();
    }

    function showBirthdayReveal() {
        if (birthdayReveal) birthdayReveal.classList.add('is-visible');
        startConfettiRain();
    }

    function playConfettiSound() {
        confettiSound.currentTime = 0;
        confettiSound.play().catch(error => {
            console.error(`Confetti sound could not play: ${error.message || error.name}`);
        });
    }

    function finishCake(showRevealImmediately = false) {
        if (cakeFinished) {
            if (!showRevealImmediately) return;
            if (revealTimeout) window.clearTimeout(revealTimeout);
            revealTimeout = 0;
            if (birthdayReveal) birthdayReveal.classList.remove('is-visible');
            stopConfettiRain();
            burstConfetti();
            playConfettiSound();
            requestAnimationFrame(() => requestAnimationFrame(() => {
                showBirthdayReveal();
            }));
            return;
        }
        cakeFinished = true;
        cakeActive = false;
        if (candleFinishTimeout) window.clearTimeout(candleFinishTimeout);
        candleFinishTimeout = 0;
        candleExtinguishTimeouts.forEach((timeout, index) => {
            if (timeout) window.clearTimeout(timeout);
            candleExtinguishTimeouts[index] = 0;
            const mesh = candleMeshes[index];
            if (mesh) mesh.userData.extinguishing = false;
        });
        if (relightTimeout) window.clearTimeout(relightTimeout);
        relightTimeout = 0;
        candleStates.fill(false);
        updateCandles();
        stopMicrophone();
        setMicStatus('All candles are out — make your wish!');
        if (revealTimeout) window.clearTimeout(revealTimeout);
        burstConfetti();
        playConfettiSound();
        if (showRevealImmediately) {
            showBirthdayReveal();
            return;
        }
        revealTimeout = window.setTimeout(() => {
            revealTimeout = 0;
            showBirthdayReveal();
        }, 700);
    }

    function countBlow(intensity) {
        if (!cakeActive) return;
        const litCandles = candleStates
            .map((isLit, index) => isLit ? index : -1)
            .filter(index => index !== -1);
        if (!litCandles.length) {
            finishCake();
            return;
        }

        const maximumByIntensity = intensity < 1.6 ? 1 : intensity < 2.6 ? 3 : intensity < 4 ? 5 : 8;
        const blownOutCount = Math.min(
            litCandles.length,
            1 + Math.floor(Math.random() * maximumByIntensity)
        );
        litCandles.sort(() => Math.random() - 0.5).slice(0, blownOutCount).forEach(index => {
            candleStates[index] = false;
            extinguishCandle(index);
        });
        updateCandles();
        const remaining = candleStates.filter(Boolean).length;
        if (!remaining) {
            setMicStatus('All candles are out — make your wish!');
            candleFinishTimeout = window.setTimeout(() => {
                candleFinishTimeout = 0;
                finishCake();
            }, 480);
            return;
        }
        setMicStatus(`${blownOutCount} candle${blownOutCount === 1 ? '' : 's'} blown out — try another fffuuuu!`);

        if (relightTimeout) window.clearTimeout(relightTimeout);
        if (Math.random() < 0.38) {
            relightTimeout = window.setTimeout(() => {
                relightTimeout = 0;
                if (!cakeActive) return;
                const eligible = candleStates
                    .map((isLit, index) => !isLit && candleRelights[index] < 2 ? index : -1)
                    .filter(index => index !== -1);
                if (!eligible.length) return;
                const relitIndex = eligible[Math.floor(Math.random() * eligible.length)];
                candleRelights[relitIndex]++;
                candleStates[relitIndex] = true;
                updateCandles();
                setMicStatus('A candle magically relit — blow it out again!');
            }, 900 + Math.random() * 900);
        }
    }

    function openCake() {
        landingView.classList.remove('active');
        landingView.classList.add('hidden');
        cakeView.classList.remove('hidden');
        cakeView.classList.add('active');
        cakeActive = true;
        initializeCandleScene();
        cakeFinished = false;
        if (candleFinishTimeout) window.clearTimeout(candleFinishTimeout);
        candleFinishTimeout = 0;
        if (revealTimeout) window.clearTimeout(revealTimeout);
        revealTimeout = 0;
        lastBlowAt = 0;
        candleStates.fill(true);
        candleRelights.fill(0);
        candleExtinguishTimeouts.forEach((timeout, index) => {
            if (timeout) window.clearTimeout(timeout);
            candleExtinguishTimeouts[index] = 0;
        });
        if (relightTimeout) window.clearTimeout(relightTimeout);
        relightTimeout = 0;
        noiseFloor = 0.008;
        updateCandles();
        if (birthdayReveal) birthdayReveal.classList.remove('is-visible');
        stopConfettiRain();
        if (confettiLayer) confettiLayer.replaceChildren();
        if (micStream) startBlowDetection();
        else requestMicrophone();
    }

    function showBirthdaySurprises() {
        cakeActive = false;
        stopConfettiRain();
        if (listeningFrame) cancelAnimationFrame(listeningFrame);
        listeningFrame = 0;
        if (birthdayReveal) birthdayReveal.classList.remove('is-visible');
        cakeView.classList.remove('active');
        cakeView.classList.add('hidden');
        celebrationView.classList.remove('hidden');
        celebrationView.classList.add('active');
        startBalloonStream();
    }

    // Request permission as soon as the page opens, before the cake interaction.
    requestMicrophone();

    if (heroVideo) {
        // Set slow-motion speed (0.5 = 50% speed, 0.75 = 75% speed)
        heroVideo.playbackRate = 0.5;

        // Ensure playback rate stays locked even after video metadata finishes loading
        heroVideo.addEventListener('loadedmetadata', () => {
            heroVideo.playbackRate = 0.5;
        });

        heroVideo.addEventListener('click', () => {
            heroVideo.paused ? heroVideo.play() : heroVideo.pause();
        });
    }

    if (openBtn) {
        openBtn.addEventListener('click', openCake);
    }

    if (cakeBackBtn) {
        cakeBackBtn.addEventListener('click', () => {
        cakeActive = false;
        stopMicrophone();
        cakeView.classList.remove('active');
            cakeView.classList.add('hidden');
            landingView.classList.remove('hidden');
            landingView.classList.add('active');
        });
    }

    if (skipCakeBtn) skipCakeBtn.addEventListener('click', () => finishCake(true));
    if (birthdayRevealBtn) birthdayRevealBtn.addEventListener('click', showBirthdaySurprises);
    if (birthdayRevealCloseBtn) {
        birthdayRevealCloseBtn.addEventListener('click', () => {
            if (birthdayReveal) birthdayReveal.classList.remove('is-visible');
            stopConfettiRain();
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            stopBalloonStream();
            celebrationView.classList.remove('active');
            celebrationView.classList.add('hidden');
            cakeView.classList.remove('hidden');
            cakeView.classList.add('active');
        });
    }

    // --- Tab Switching Logic ---
    const menuBtns = document.querySelectorAll('.menu-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    menuBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            menuBtns.forEach(b => b.classList.remove('active-tab'));
            tabContents.forEach(tc => {
                tc.classList.remove('active-content');
                tc.classList.add('hidden-content');
            });
            btn.classList.add('active-tab');
            const targetId = btn.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('hidden-content');
                targetSection.classList.add('active-content');
            }
        });
    });

    // =====================================================
    // --- Film Strip Logic ---
    // =====================================================
    const btnYours = document.getElementById('btn-yours');
    const btnOurs = document.getElementById('btn-ours');
    const memoriesMenu = document.getElementById('memories-menu');
    const filmstripView = document.getElementById('filmstrip-view');
    const fsBackBtn = document.getElementById('fs-back-btn');
    const filmstripTrack = document.getElementById('filmstrip-track');

    // Save original Yours HTML before any JS touches it
    const yoursHTML = filmstripTrack ? filmstripTrack.innerHTML : '';

    const oursFrames = [
        { n: '01', src: 'media/ours/1.jpg', alt: 'Ours Memory 1' },
        { n: '02', src: 'media/ours/2.jpg', alt: 'Ours Memory 2' },
        { n: '03', src: 'media/ours/3.jpg', alt: 'Ours Memory 3' },
        { n: '04', src: 'media/ours/4.jpg', alt: 'Ours Memory 4' },
        { n: '05', src: 'media/ours/5.jpg', alt: 'Ours Memory 5' },
        { n: '06', src: 'media/ours/6.jpg', alt: 'Ours Memory 6' },
        { n: '07', src: 'media/ours/7.jpg', alt: 'Ours Memory 7' },
    ];

    // ---- Highlight the frame closest to the viewport centre ----
    function updateActiveFrame() {
        if (!filmstripTrack) return;
        const frames = filmstripTrack.querySelectorAll('.film-frame');
        const trackRect = filmstripTrack.getBoundingClientRect();
        const viewCenter = trackRect.left + trackRect.width / 2;

        let minDist = Infinity;
        let centerFrame = null;

        frames.forEach(frame => {
            const r = frame.getBoundingClientRect();
            const dist = Math.abs((r.left + r.width / 2) - viewCenter);
            if (dist < minDist) { minDist = dist; centerFrame = frame; }
        });

        frames.forEach(f => f.classList.remove('active-frame'));
        if (centerFrame) centerFrame.classList.add('active-frame');
    }

    // ---- Silently jump back to the middle copy of the triplicated track ----
    function correctLoopBoundary() {
        if (!filmstripTrack) return;
        const total = filmstripTrack.scrollWidth;
        const third = total / 3;
        const pos = filmstripTrack.scrollLeft;

        // If we drifted into the left clone set, jump forward
        if (pos < third) {
            filmstripTrack.style.scrollBehavior = 'auto';
            filmstripTrack.scrollLeft = pos + third;
            filmstripTrack.style.scrollBehavior = 'smooth';
        }
        // If we drifted into the right clone set, jump back
        else if (pos > third * 2) {
            filmstripTrack.style.scrollBehavior = 'auto';
            filmstripTrack.scrollLeft = pos - third;
            filmstripTrack.style.scrollBehavior = 'smooth';
        }
    }

    // ---- Build the triplicated track (run once per content set) ----
    function buildInfiniteLoop() {
        if (!filmstripTrack) return;

        const original = Array.from(filmstripTrack.children);
        if (original.length === 0) return;

        const before = original.map(n => n.cloneNode(true));
        const after  = original.map(n => n.cloneNode(true));

        before.forEach(c => filmstripTrack.insertBefore(c, original[0]));
        after.forEach(c  => filmstripTrack.appendChild(c));
    }

    // ---- Open the filmstrip after content has been set ----
    function openFilmstrip() {
        memoriesMenu.classList.add('is-hidden');
        filmstripView.classList.remove('is-hidden');

        buildInfiniteLoop();

        // Wait for the browser to finish layout (images need a moment)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const third = filmstripTrack.scrollWidth / 3;
                filmstripTrack.style.scrollBehavior = 'auto';
                filmstripTrack.scrollLeft = third;
                // Let the instant scroll settle, then enable smooth and update
                setTimeout(() => {
                    filmstripTrack.style.scrollBehavior = 'smooth';
                    updateActiveFrame();
                }, 50);
            });
        });
    }

    // ---- Yours button ----
    if (btnYours && filmstripView) {
        btnYours.addEventListener('click', () => {
            filmstripTrack.innerHTML = yoursHTML;   // restore original frames
            openFilmstrip();
        });
    }

    // ---- Ours button ----
    if (btnOurs && filmstripView) {
        btnOurs.addEventListener('click', () => {
            filmstripTrack.innerHTML = oursFrames.map(f =>
                `<div class="film-frame">
                    <span class="frame-number">KODAK 400 • ${f.n}</span>
                    <div class="photo-box"><img src="${f.src}" alt="${f.alt}" /></div>
                </div>`
            ).join('');
            openFilmstrip();
        });
    }

    // ---- Back button ----
    if (fsBackBtn) {
        fsBackBtn.addEventListener('click', () => {
            filmstripView.classList.add('is-hidden');
            memoriesMenu.classList.remove('is-hidden');
        });
    }

    // ---- Scroll: update active frame + debounced loop correction ----
    if (filmstripTrack) {
        let scrollTimer;

        filmstripTrack.addEventListener('scroll', () => {
            // Highlight during scroll (live)
            window.requestAnimationFrame(updateActiveFrame);

            // After scrolling stops: correct the boundary then re-highlight
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                correctLoopBoundary();
                // After the instant jump settles, update highlight
                setTimeout(updateActiveFrame, 50);
            }, 180);
        });
    }

    // --- Love Meter Logic ---
    const calcLoveBtn = document.getElementById('calc-love-btn');
    const loveInput = document.getElementById('love-input');
    const loveResult = document.getElementById('love-result');
    const nameMemory = {};
    let lastScannedName = '';

    if (loveInput) {
        loveInput.addEventListener('input', function () {
            this.value = this.value.toLowerCase().replace(/[^a-z]/g, '');
        });
    }

    function performScan() {
        if (!loveInput || !loveResult) return;
        const name = loveInput.value;

        if (name === '') {
            loveResult.textContent = 'Please enter a name!';
            return;
        }
        if (name === lastScannedName) return;
        lastScannedName = name;

        let minRange, maxRange;

        if (name === 'shiva' || name === 'shivateja') {
            minRange = 82; maxRange = 94;
        } else if (name === 'pinky' || name === 'vaish' || name === 'vaishu' || name === 'vaishnavi') {
            minRange = 94; maxRange = 99;
            
        } else {
            if (nameMemory[name] !== undefined) {
                minRange = nameMemory[name];
            } else {
                minRange = Math.floor(Math.random() * 83) + 1;
                nameMemory[name] = minRange;
            }
            maxRange = minRange + Math.floor(Math.random() * 4) + 6;
        }

        const pct = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
        const scoreHue = pct <= 50 ? pct * 1.2 : 60 + (pct - 50) * 3.6;
        loveResult.replaceChildren();
        const message = document.createElement('span');
        message.className = 'love-result-message';
        message.textContent = 'They love you';
        const score = document.createElement('span');
        score.className = 'love-result-score';
        score.textContent = `${pct}%`;
        score.style.setProperty('--score-hue', `${scoreHue}`);
        loveResult.append(message, score);
    }

    if (calcLoveBtn) calcLoveBtn.addEventListener('click', performScan);
    if (loveInput) {
        loveInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') performScan();
        });
    }
});

// ==== UI protection helpers ====
document.addEventListener('contextmenu', ev => ev.preventDefault());

document.addEventListener('keydown', ev => {
    const blocked =
        ev.key === 'F12' ||
        (ev.ctrlKey && ev.shiftKey && ['I', 'J', 'C'].includes(ev.key)) ||
        (ev.ctrlKey && ev.key === 'U');
    if (blocked) ev.preventDefault();
});

/* =====================================================
   Birthday Gallery Card (hinged 2x2 card, 4 views)
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const card    = document.getElementById('card');
    if (!card) return;

    const cells = {
        tl: document.getElementById('cell-tl'),
        tr: document.getElementById('cell-tr'),
        bl: document.getElementById('cell-bl'),
        br: document.getElementById('cell-br')
    };
    const prevBtn = document.getElementById('card-prev');
    const nextBtn = document.getElementById('card-next');
    const dotsBox = document.getElementById('card-dots');

    // ---------- 1. CONTENT: 4 views x 4 squares = 16 squares ----------
    const pic = n => `media/card/${n}.png`;

    const VIEWS = [
        { tl: pic(1),  tr: pic(2),  bl: pic(3),  br: pic(4)  },
        { tl: pic(5),  tr: pic(6),  bl: pic(7), br: pic(8) },
        { tl: pic(9),  tr: pic(10),  bl: pic(11), br: pic(12) },
        { tl: pic(13), tr: pic(14), bl: pic(15), br: pic(16) }
    ];
    const KEYS = ['tl', 'tr', 'bl', 'br'];

    // preload every picture once, reuse the loaded nodes later
    const cache = {};
    VIEWS.forEach(v => KEYS.forEach(k => {
        const item = v[k];
        if (typeof item === 'string' && !cache[item]) {
            const img = new Image();
            img.src = item;
            img.alt = '';
            img.draggable = false;
            cache[item] = img;
        }
    }));

    let painted = -1;
    function paint(index) {
        if (painted === index) return;
        painted = index;
        KEYS.forEach(k => {
            const item = VIEWS[index][k];
            ['.face-front', '.face-back'].forEach(selector => {
                const face = cells[k].querySelector(selector);
                if (typeof item === 'object') {
                    face.classList.add('is-text');
                    face.innerHTML = `<span>${item.text}</span>`;
                } else {
                    face.classList.remove('is-text');
                    face.replaceChildren(cache[item].cloneNode());
                }
            });
        });
    }

    // ---------- 2. THE FOLD ----------
    // Each opening folds the quadrants edge-on, then opens them from a new
    // axis behind the paper stack and flattens them again.
    // Consecutive openings alternate between the vertical and horizontal creases.
    const DURATION = 4000;   // ms for one full transition
    const GAP      = 11.34;  // 3 mm: 2 mm sheet thickness plus a 1 mm visible gap

    const clamp01 = x => Math.min(1, Math.max(0, x));
    const ease    = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function pose(p, axis) {
        const progress = clamp01(p);
        const phase = progress <= 0.5 ? progress * 2 : (progress - 0.5) * 2;
        const foldAngle = progress <= 0.5
            ? 90 * ease(phase)
            : 90;
        const unfoldAngle = progress > 0.5 ? 90 * ease(phase) : 0;
        const stack = Math.sin(Math.PI * progress);

        // NEW: Continuous mathematical depth offset. 
        // Math.pow(progress, 4) creates a beautiful curve that allows the card to 
        // push backwards naturally, then smoothly and slowly zoom forward to 0 
        // without any snaps in BOTH directions.
        const s = cells.tl.offsetWidth;
        const zOffset = s * Math.pow(progress, 4);
        card.style.transform = `translateZ(${zOffset}px)`;

        Object.entries(cells).forEach(([key, cell]) => {
            const panel = cell.querySelector('.card-panel');
            const isFirstSide = axis === 'vertical'
                ? key.endsWith('l')
                : key.startsWith('t');
            const foldOrigin = axis === 'vertical'
                ? (isFirstSide ? 'right center' : 'left center')
                : (isFirstSide ? 'center bottom' : 'center top');
            const unfoldOrigin = axis === 'vertical'
                ? (isFirstSide ? 'left center' : 'right center')
                : (isFirstSide ? 'center top' : 'center bottom');
            const direction = axis === 'vertical'
                ? (isFirstSide ? -1 : 1)
                : (isFirstSide ? 1 : -1);
            const fold = axis === 'vertical'
                ? `rotateY(${direction * foldAngle}deg)`
                : `rotateX(${direction * foldAngle}deg)`;
            const unfold = axis === 'vertical'
                ? `rotateY(${direction * unfoldAngle}deg)`
                : `rotateX(${direction * unfoldAngle}deg)`;
            const layer = isFirstSide ? -1 : 0;

            cell.classList.toggle('axis-h', axis === 'horizontal');
            cell.style.transformOrigin = foldOrigin;
            cell.style.transform = `translateZ(${layer * GAP * stack}px) ${fold}`;
            panel.style.transformOrigin = unfoldOrigin;
            panel.style.transform = unfold;
        });
    }

    // ---------- 3. NAVIGATION ----------
    let current = 0;
    let busy = false;

    function updateUI() {
        prevBtn.disabled = busy;
        nextBtn.disabled = busy;
        if (dotsBox) {
            [...dotsBox.children].forEach((d, i) => d.classList.toggle('on', i === current));
        }
    }

    if (dotsBox) {
        dotsBox.innerHTML = VIEWS.map(() => '<span></span>').join('');
    }

    function go(dir) {
        if (busy) return;
        const from = current;
        const to = (current + dir + VIEWS.length) % VIEWS.length;
        const forward = dir > 0;

        // A previous action reuses the axis of the corresponding next action.
        const transitionIndex = forward ? from : to;
        const axis = transitionIndex % 2 === 0 ? 'vertical' : 'horizontal';
        const lowView  = forward ? from : to;
        const highView = forward ? to : from;
        const p0 = forward ? 0 : 1;
        const p1 = forward ? 1 : 0;

        busy = true;
        updateUI();
        const start = performance.now();

        function frame(now) {
            const t = clamp01((now - start) / DURATION);
            const p = p0 + (p1 - p0) * t;
            paint(p < 0.5 ? lowView : highView);
            pose(p, axis);
            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                current = to;
                paint(to);
                pose(0, axis);
                busy = false;
                updateUI();
            }
        }
        requestAnimationFrame(frame);
    }

    nextBtn.addEventListener('click', () => go(1));
    prevBtn.addEventListener('click', () => go(-1));

    paint(0);
    pose(0, 'vertical');
    updateUI();
});
