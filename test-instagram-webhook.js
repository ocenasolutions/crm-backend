const fetch = require('node-fetch');

const testPayload = {
  "entry": [{
    "messaging": [{
      "sender": {
        "id": "vibenames",
        "username": "aditya"
      },
      "message": {
        "text": "Test message from Instagram"
      }
    }]
  }]
};

fetch('http://localhost:5000/api/webhooks/instagram', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testPayload)
})
.then(res => res.text())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));