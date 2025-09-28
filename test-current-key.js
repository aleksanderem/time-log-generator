// Test current API key
const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const apiKey = envContent.match(/VITE_OPENAI_API_KEY=(.*)/)[1].trim();

console.log('Testing API key...');

fetch('https://api.openai.com/v1/models', {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
})
.then(res => {
  console.log('Status:', res.status);
  if (res.status === 401) {
    console.log('❌ API key is invalid or expired');
  } else if (res.status === 200) {
    console.log('✅ API key is valid');
  } else {
    console.log('⚠️ Unexpected status:', res.status);
  }
  return res.json();
})
.then(data => {
  if (data.error) {
    console.log('Error:', data.error);
  }
})
.catch(err => console.error('Network error:', err));