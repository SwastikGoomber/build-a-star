// geometry.js
// Core utility functions
export function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

export function distance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function angleBetween(center, p1, p2) {
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  return Math.abs(a1 - a2);
}

export function calculateCentroid(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

// Downsamples the path to reduce noise and improve performance
export function downsamplePath(path, sampleRate) {
  const result = [];
  for (let i = 0; i < path.length; i += sampleRate) {
    result.push(path[i]);
  }
  // Always include the last point to close the shape
  if (path.length > 0 && (path.length - 1) % sampleRate !== 0) {
    result.push(path[path.length - 1]);
  }
  return result;
}

// Calculates polar coordinates (distance and angle) from centroid
export function getPolarCoordinates(points, centroid) {
  return points.map(p => ({
    point: p,
    angle: Math.atan2(p.y - centroid.y, p.x - centroid.x),
    distance: distance(p, centroid)
  }));
}

// Detects potential vertices (points of the star)
export function detectVertices(polar) {
  // Sort by angle for consistent processing
  const sorted = [...polar].sort((a, b) => a.angle - b.angle);
  
  // Find local maxima in distances (star points)
  const vertices = [];
  // Smaller window for better detection of points
  const window = Math.max(3, Math.floor(sorted.length / 30)); 
  
  for (let i = 0; i < sorted.length; i++) {
    let isLocalMax = true;
    for (let j = 1; j <= window; j++) {
      // Check in both directions within window
      const prev = (i - j + sorted.length) % sorted.length;
      const next = (i + j) % sorted.length;
      if (sorted[i].distance < sorted[prev].distance || 
          sorted[i].distance < sorted[next].distance) {
        isLocalMax = false;
        break;
      }
    }
    if (isLocalMax) {
      vertices.push(sorted[i]);
    }
  }
  
  // Filter vertices that are too close to each other
  const filteredVertices = [];
  const minAngleDiff = 0.2; // Minimum angle difference between vertices
  
  if (vertices.length > 0) {
    filteredVertices.push(vertices[0]);
    
    for (let i = 1; i < vertices.length; i++) {
      let tooClose = false;
      for (let j = 0; j < filteredVertices.length; j++) {
        const angleDiff = Math.abs(vertices[i].angle - filteredVertices[j].angle);
        if (angleDiff < minAngleDiff || 2 * Math.PI - angleDiff < minAngleDiff) {
          tooClose = true;
          // Keep the one with larger distance
          if (vertices[i].distance > filteredVertices[j].distance) {
            filteredVertices[j] = vertices[i];
          }
          break;
        }
      }
      
      if (!tooClose) {
        filteredVertices.push(vertices[i]);
      }
    }
  }
  
  return filteredVertices;
}

// Checks if shape has self-intersections (for cross-type stars)
export function hasSelfIntersections(points) {
  let count = 0;
  // Use more segments for better detection
  const stride = Math.max(1, Math.floor(points.length / 40));
  
  // Helper function to check if two segments intersect
  function segmentsIntersect(a1, a2, b1, b2) {
    // Check if either of the segments is a single point
    if ((a1.x === a2.x && a1.y === a2.y) || (b1.x === b2.x && b1.y === b2.y)) {
      return false;
    }
    
    function ccw(p1, p2, p3) {
      return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
    }
    
    return (
      ccw(a1, b1, b2) !== ccw(a2, b1, b2) && 
      ccw(a1, a2, b1) !== ccw(a1, a2, b2)
    );
  }
  
  for (let i = 0; i < points.length - stride; i += stride) {
    const a1 = points[i];
    const a2 = points[i + stride];
    
    for (let j = i + 2 * stride; j < points.length - stride; j += stride) {
      const b1 = points[j];
      const b2 = points[j + stride];
      
      if (segmentsIntersect(a1, a2, b1, b2)) {
        count++;
        // Only need a few intersections to confirm it's a cross-type star
        if (count >= 2) return true;
      }
    }
  }
  
  return count >= 2;
}

// Core star detection function
export function isStarLike(path, config) {
  if (path.length < config.MIN_POINTS) return false;
  
  // Downsample path for more reliable analysis
  const sampledPath = downsamplePath(path, config.SAMPLE_RATE);
  
  // Get centroid and convert to polar coordinates
  const centroid = calculateCentroid(sampledPath);
  const polar = getPolarCoordinates(sampledPath, centroid);
  
  // Detect vertices (star points)
  const vertices = detectVertices(polar);
  
  // A star should have between the configured min and max points
  if (vertices.length < config.STAR_POINTS_MIN || 
      vertices.length > config.STAR_POINTS_MAX) {
    return false;
  }
  
  // Check for key star characteristics
  const isCrossStar = hasSelfIntersections(sampledPath);
  
  // Check for regular angular spacing of vertices
  const vertexAngles = vertices.map(v => v.angle);
  vertexAngles.sort((a, b) => a - b);
  
  // Calculate angular differences between consecutive vertices
  const angleDiffs = [];
  for (let i = 0; i < vertexAngles.length; i++) {
    const next = (i + 1) % vertexAngles.length;
    let diff = vertexAngles[next] - vertexAngles[i];
    if (diff < 0) diff += 2 * Math.PI;
    angleDiffs.push(diff);
  }
  
  // Check for regularities in angular spacing
  const avgDiff = angleDiffs.reduce((sum, diff) => sum + diff, 0) / angleDiffs.length;
  const angleVariance = angleDiffs.reduce((sum, diff) => sum + Math.abs(diff - avgDiff), 0) / angleDiffs.length;
  
  // Check for distance variations (peaks and valleys)
  const distanceSorted = [...polar].sort((a, b) => a.angle - b.angle);
  const distances = distanceSorted.map(p => p.distance);
  
  let peakCount = 0;
  let valleyCount = 0;
  
  // Circular array to handle wraparound
  const extendedDistances = [...distances, ...distances.slice(0, 10)];
  
  for (let i = 5; i < distances.length + 5; i++) {
    // Use a window to detect peaks and valleys
    const window = 5;
    let isPeak = true;
    let isValley = true;
    
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      
      if (extendedDistances[i] <= extendedDistances[j]) {
        isPeak = false;
      }
      if (extendedDistances[i] >= extendedDistances[j]) {
        isValley = false;
      }
    }
    
    if (isPeak) peakCount++;
    if (isValley) valleyCount++;
  }
  
  // Calculate distance range for variation check
  const maxDist = Math.max(...distances);
  const minDist = Math.min(...distances);
  const distRange = maxDist - minDist;
  const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
  
  // Calculate variations relative to average
  const variations = distances.map(d => Math.abs(d - avgDist) / avgDist);
  const avgVariation = variations.reduce((a, b) => a + b, 0) / variations.length;
  
  // Star criteria: 
  // 1. Cross star OR
  // 2. Regular star with relatively even angle distribution and significant distance variations
  // 3. The shape must either have enough peaks/valleys or significant distance variations
  return isCrossStar || 
         (angleVariance < 0.6 && distRange / avgDist > 0.2) || 
         (peakCount >= vertices.length / 2 && valleyCount >= vertices.length / 2);
}

// Calculate star perfection score
export function calculatePerfection(path, config) {
  // Downsample path for more reliable analysis
  const sampledPath = downsamplePath(path, config.SAMPLE_RATE);
  
  // Get centroid and convert to polar coordinates
  const centroid = calculateCentroid(sampledPath);
  const polar = getPolarCoordinates(sampledPath, centroid);
  
  // Detect vertices (star points)
  const vertices = detectVertices(polar);
  
  // 1. Angular symmetry score (are star points evenly spaced?)
  const vertexAngles = vertices.map(v => v.angle);
  vertexAngles.sort((a, b) => a - b);
  
  const angleDiffs = [];
  for (let i = 0; i < vertexAngles.length; i++) {
    const next = (i + 1) % vertexAngles.length;
    let diff = vertexAngles[next] - vertexAngles[i];
    if (diff < 0) diff += 2 * Math.PI;
    angleDiffs.push(diff);
  }
  
  const avgDiff = angleDiffs.reduce((sum, diff) => sum + diff, 0) / angleDiffs.length;
  const angleDeviation = angleDiffs.reduce((sum, diff) => 
    sum + Math.abs(diff - avgDiff) / avgDiff, 0) / angleDiffs.length;
  
  const angularSymmetryScore = Math.max(0, 1 - angleDeviation * 1.5);
  
  // 2. Radial symmetry score (are all points equally distant from center?)
  const vertexDistances = vertices.map(v => v.distance);
  const avgDistance = vertexDistances.reduce((sum, d) => sum + d, 0) / vertexDistances.length;
  const distanceDeviation = vertexDistances.reduce((sum, d) => 
    sum + Math.abs(d - avgDistance) / avgDistance, 0) / vertexDistances.length;
  
  const radialSymmetryScore = Math.max(0, 1 - distanceDeviation * 1.5);
  
  // 3. Line smoothness score - more weight for straight lines
  let smoothnessScore = 0;
  if (sampledPath.length >= 3) {
    let totalDeviation = 0;
    let deviationPoints = 0;
    
    for (let i = 1; i < sampledPath.length - 1; i++) {
      const prev = sampledPath[i-1];
      const curr = sampledPath[i];
      const next = sampledPath[i+1];
      
      // Calculate how much the current point deviates from a straight line
      const midpoint = {
        x: (prev.x + next.x) / 2,
        y: (prev.y + next.y) / 2
      };
      
      const segmentLength = distance(prev, next);
      if (segmentLength > 0) {
        const deviation = distance(curr, midpoint) / segmentLength;
        totalDeviation += deviation;
        deviationPoints++;
      }
    }
    
    // Lower deviation is better for straight lines
    const avgDeviation = deviationPoints > 0 ? totalDeviation / deviationPoints : 0;
    
    // Penalize wobbly lines more severely
    smoothnessScore = Math.max(0, 1 - avgDeviation * 3);
  }
  
  // 4. Closure score (is the shape closed?)
  const start = sampledPath[0];
  const end = sampledPath[sampledPath.length - 1];
  const closureDistance = distance(start, end);
  const maxPathDist = Math.max(...sampledPath.map(p => 
    distance(p, centroid)));
  
  const closureScore = Math.max(0, 1 - (closureDistance / maxPathDist) * 2);
  
  // 5. Convexity/Concavity pattern score (stars have alternate peaks and valleys)
  let patternScore = 0;
  
  if (vertices.length >= 4) {
    // Calculate distances from the center at regular angular intervals
    const numSamples = 72; // Sample every 5 degrees
    const samples = [];
    
    for (let i = 0; i < numSamples; i++) {
      const angle = (i / numSamples) * 2 * Math.PI;
      
      // Find the closest point in the path to this angle
      let bestDiff = Infinity;
      let bestDist = 0;
      
      for (const p of polar) {
        const angleDiff = Math.min(
          Math.abs(p.angle - angle),
          2 * Math.PI - Math.abs(p.angle - angle)
        );
        
        if (angleDiff < bestDiff) {
          bestDiff = angleDiff;
          bestDist = p.distance;
        }
      }
      
      samples.push(bestDist);
    }
    
    // Look for alternating pattern of peaks and valleys
    let alternatingCount = 0;
    let lastWasPeak = null;
    
    for (let i = 0; i < samples.length; i++) {
      const prev = samples[(i - 1 + samples.length) % samples.length];
      const curr = samples[i];
      const next = samples[(i + 1) % samples.length];
      
      const isPeak = curr > prev && curr > next;
      const isValley = curr < prev && curr < next;
      
      if (isPeak || isValley) {
        if (lastWasPeak !== null && isPeak !== lastWasPeak) {
          alternatingCount++;
        }
        lastWasPeak = isPeak;
      }
    }
    
    // A perfect star should have at least 2*vertices alternating pattern
    const expectedAlternations = vertices.length * 2;
    patternScore = Math.min(1, alternatingCount / expectedAlternations);
  }
  
  // Calculate final score - weighted average of all metrics with emphasis on smoothness and symmetry
  // Adjust weights to better detect good vs bad stars
  return (
    angularSymmetryScore * 0.25 + 
    radialSymmetryScore * 0.2 + 
    smoothnessScore * 0.3 + 
    closureScore * 0.1 +
    patternScore * 0.15
  );
}