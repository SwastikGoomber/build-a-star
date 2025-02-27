// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const roastDisplay = document.getElementById('roast-display');
const tryAgainButton = document.getElementById('tryAgain');
const perfectCounter = document.getElementById('perfectCounter');
const attemptCounter = document.getElementById('attemptCounter');

import { CONFIG } from './config.js';
import { ROASTS } from './roasts.js';
import { 
  getMousePos, isStarLike, calculatePerfection, 
  downsamplePath
} from './geometry.js';

let currentPath = [];
let attempts = 0;
let perfectStars = 0;
let isDrawing = false;
let validationTimeout;
let lastDrawingTime = 0;
let scoreGiven = false; // Track if a score has been given for the current drawing

// Canvas setup
function resizeCanvas() {
  const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.7);
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Event handlers
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endDrawing);
canvas.addEventListener('touchstart', handleTouchStart);
canvas.addEventListener('touchmove', handleTouchMove);
canvas.addEventListener('touchend', handleTouchEnd);
tryAgainButton.addEventListener('click', resetCanvas);

// Touch support
function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}

function handleTouchEnd(e) {
  e.preventDefault();
  const mouseEvent = new MouseEvent('mouseup', {});
  canvas.dispatchEvent(mouseEvent);
}

// Drawing functions
function startDrawing(e) {
  // Auto-clear if there's already a drawing AND either:
  // 1. A score has already been given, OR
  // 2. More than 2 seconds have passed since last drawing
  const currentTime = Date.now();
  if (currentPath.length > 0 && (scoreGiven || (currentTime - lastDrawingTime > 2000))) {
    resetCanvas();
  }
  
  isDrawing = true;
  currentPath = [];
  clearTimeout(validationTimeout);
  scoreGiven = false; // Reset score given flag
  
  // Hide the try again button when starting a new drawing
  tryAgainButton.classList.remove('visible');
  
  // Only clear roast display if it contains text
  // (prevents the box from disappearing momentarily)
  if (roastDisplay.textContent.trim() !== '') {
    roastDisplay.classList.add('fade-out');
    setTimeout(() => {
      roastDisplay.textContent = '';
      roastDisplay.classList.remove('fade-out');
    }, 300);
  }
  
  const pos = getMousePos(canvas, e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.strokeStyle = '#00ff9d';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  currentPath.push(pos);
  
  // Add subtle particle effect at the start point
  createDrawingParticle(pos.x, pos.y);
}

function draw(e) {
  if (!isDrawing) return;
  const pos = getMousePos(canvas, e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  currentPath.push(pos);
  
  // Occasionally add particles while drawing
  if (Math.random() < 0.1) {
    createDrawingParticle(pos.x, pos.y);
  }
  
  lastDrawingTime = Date.now();
}

function endDrawing() {
  if (!isDrawing || currentPath.length < CONFIG.MIN_POINTS) return;
  isDrawing = false;
  validationTimeout = setTimeout(() => {
    const result = validateStar();
    handleResult(result);
    updateCounters();
    scoreGiven = true; // Mark that a score has been given
  }, 500);
  
  lastDrawingTime = Date.now();
}

// Star validation
function validateStar() {
  // Determine if drawing resembles a star
  if (!isStarLike(currentPath, CONFIG)) {
    return {
      valid: false,
      message: getRandomRoast(ROASTS.not_star)
    };
  }
  
  // Calculate how perfect the star is
  const perfection = calculatePerfection(currentPath, CONFIG);
  console.log("Star perfection score:", perfection);
  
  // Determine which roast to use based on perfection score
  let message;
  if (perfection >= CONFIG.PERFECT_THRESHOLD) {
    message = getRandomRoast(ROASTS.perfect).replace('%a', attempts);
  } else if (perfection >= CONFIG.GOOD_THRESHOLD) {
    message = getRandomRoast(ROASTS.good_star);
  } else {
    message = getRandomRoast(ROASTS.bad_star);
  }
  
  return {
    valid: true,
    perfection: perfection,
    message: message
  };
}

function getRandomRoast(roastArray) {
  return roastArray[Math.floor(Math.random() * roastArray.length)];
}

// UI handling
function handleResult(result) {
  // Add fade-in animation to the result message
  roastDisplay.classList.add('fade-in');
  roastDisplay.textContent = result.message;
  
  setTimeout(() => {
    roastDisplay.classList.remove('fade-in');
  }, 300);
  
  if (result.valid) {
    if (result.perfection >= CONFIG.PERFECT_THRESHOLD) {
      perfectStars++;
      attempts = 0;
      triggerConfetti();
      canvas.classList.add('perfect-glow');
      setTimeout(() => {
        canvas.classList.remove('perfect-glow');
      }, 2000);
    } else {
      attempts++;
      
      // Add shake animation for non-perfect stars
      if (result.perfection < CONFIG.GOOD_THRESHOLD) {
        canvas.classList.add('shake');
        setTimeout(() => {
          canvas.classList.remove('shake');
        }, 500);
      }
    }
  } else {
    attempts++;
    // Add shake animation for non-stars
    canvas.classList.add('shake');
    setTimeout(() => {
      canvas.classList.remove('shake');
    }, 500);
  }
  
  // Always show the try again button now
  tryAgainButton.classList.add('visible');
  tryAgainButton.classList.add('pulse');
  setTimeout(() => {
    tryAgainButton.classList.remove('pulse');
  }, 1000);
}

function resetCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  updateCounters();
  tryAgainButton.classList.remove('visible');
  roastDisplay.textContent = '';
  currentPath = [];
  scoreGiven = false; // Reset score given flag
}

function updateCounters() {
  attemptCounter.textContent = `Attempts: ${attempts}`;
  perfectCounter.textContent = `Perfect: ${perfectStars}`;
  
  // Add animation to counters when they update
  attemptCounter.classList.add('counter-update');
  perfectCounter.classList.add('counter-update');
  
  setTimeout(() => {
    attemptCounter.classList.remove('counter-update');
    perfectCounter.classList.remove('counter-update');
  }, 300);
}

function createDrawingParticle(x, y) {
  const particle = document.createElement('div');
  particle.className = 'drawing-particle';
  particle.style.left = `${x + canvas.offsetLeft}px`;
  particle.style.top = `${y + canvas.offsetTop}px`;
  document.body.appendChild(particle);
  
  setTimeout(() => {
    particle.remove();
  }, 500);
}

function triggerConfetti() {
  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    const size = 5 + Math.random() * 10;
    const randomRotation = Math.random() * 360;
    
    confetti.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      background: hsl(${Math.random() * 360}, 100%, 50%);
      left: ${Math.random() * 100}vw;
      top: -10px;
      animation: confettiFall ${2 + Math.random() * 5}s cubic-bezier(0.1, 0.8, 0.3, 1);
      transform: rotate(${randomRotation}deg);
      border-radius: ${Math.random() < 0.5 ? '50%' : '2px'};
      z-index: 9999;
    `;
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 5000);
  }
}