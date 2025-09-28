// Test vision API
// Provide your key via environment: OPENAI_API_KEY or VITE_OPENAI_API_KEY
const API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || 'YOUR_API_KEY_HERE';

// Small test image (1x1 red pixel)
const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'What color is this image?' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${testImage}` } }
      ]
    }],
    max_tokens: 50
  })
})
.then(res => res.json())
.then(data => {
  console.log('Response:', JSON.stringify(data, null, 2));
})
.catch(err => console.error('Error:', err));
