// Test API with better error handling
// Provide your key via environment: OPENAI_API_KEY or VITE_OPENAI_API_KEY
const API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

async function testAPI() {
  console.log('Testing OpenAI API...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Generate a JSON array with one task: [{"time": "2.50", "task": "Test task", "comments": ""}]'
          }
        ],
        max_tokens: 100
      })
    });

    console.log('Status:', response.status);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data);
      return;
    }

    console.log('Response:', data.choices[0].message.content);
  } catch (error) {
    console.error('Network error:', error);
  }
}

testAPI();
