// Test OpenAI API
// Provide your key via environment: OPENAI_API_KEY or VITE_OPENAI_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

async function testAPI() {
  console.log('Testing OpenAI API...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Say "API works!" if you can read this.'
          }
        ],
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      return;
    }

    const data = await response.json();
    console.log('API Response:', data.choices[0].message.content);
  } catch (error) {
    console.error('Network error:', error);
  }
}

testAPI();
