'use strict';
// GitHub Pages serves the static explorer; the existing service retains the
// original-image API and the same persistent download history.
const FACE_API_ORIGIN = location.origin === 'https://ai-face-by-illinois.github.io'
  ? 'https://child-ai-face-atlas.mighty-cup-0464.chatgpt.site'
  : '';
function faceApiUrl(path) {
  return FACE_API_ORIGIN + path;
}
