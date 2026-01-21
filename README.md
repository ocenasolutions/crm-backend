A comprehensive Node.js backend system for managing customer leads across multiple communication channels including WhatsApp, Facebook Messenger, Instagram, and Email.
Features

Multi-Platform Lead Capture: Automatically capture leads from various channels

Instagram (Messages, Follows, Comments, Mentions)
WhatsApp
Facebook Messenger


Intelligent Lead Management

Lead qualification (Hot, Warm, Cold)
Status tracking (New, Contacted, Follow-up, Converted, Closed)
Interaction type categorization
Automated response system


Instagram Advanced Features

Auto-reply to direct messages
Welcome messages for new followers
Comment engagement tracking
Mention detection and response
Follower analytics


User Management

JWT-based authentication
Role-based access control
Lead assignment to team members


Analytics & Reporting

Platform-wise lead distribution
Interaction type statistics
Lead qualification metrics
Real-time dashboard data

Tech Stack

Runtime: Node.js
Framework: Express.js
Database: MongoDB (Mongoose ODM)
Authentication: JWT (jsonwebtoken)
Password Hashing: bcryptjs
Email: Nodemailer, IMAP
APIs: Facebook Graph API, Instagram Messaging API, Twilio (WhatsApp)

Installation
Prerequisites

Node.js (v14 or higher)
MongoDB (local or cloud instance)
Instagram Business Account
Facebook Page (connected to Instagram)

Setup Steps

Clone the repository

bashgit clone <repository-url>
cd omnichannel-crm-backend

Install dependencies

bashnpm install

Configure environment variables

Create a .env file in the root directory:
env# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/crm_db
# or use MongoDB Atlas
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/crm

# Email Configuration (Optional)
ENABLE_EMAIL_MONITORING=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993

# WhatsApp (Twilio) - Optional
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Facebook Messenger
FB_VERIFY_TOKEN=your_custom_verify_token
FB_PAGE_ACCESS_TOKEN=your_facebook_page_access_token

# Instagram
IG_VERIFY_TOKEN=your_custom_verify_token
IG_ACCESS_TOKEN=your_instagram_access_token
IG_BUSINESS_ACCOUNT_ID=your_instagram_business_account_id
IG_USERNAME=your_instagram_username

# Auto-Reply Messages
IG_AUTO_REPLY_MESSAGE=Thanks for reaching out! We've received your message and will get back to you soon. 😊
IG_FOLLOW_MESSAGE=Hey! Thanks for following us! 🎉 Feel free to send us a message if you have any questions!
IG_COMMENT_REPLY_MESSAGE=Thanks for your comment! We appreciate your engagement! 💬
IG_MENTION_REPLY_MESSAGE=Wow! Thanks so much for mentioning us! 🙌 We really appreciate it!

Start the server
node server / npm start
