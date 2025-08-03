# Gemini Backend

A backend service for a Gemini Chat clone that delivers AI-generated responses and manages user access via a subscription system. It integrates Stripe for billing, Redis for message queue processing, and Prisma with PostgreSQL, with real-time handling of upgrades, renewals, and cancellations through Stripe webhooks.


## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`PORT`

`DATABASE_URL`

`JWT_SECRET`

`OTP_EXPIRATION_MINUTES`

`PASSWORD_SALT_ROUNDS`

`NODE_ENV`

`REDIS_URL`

`CHATROOM_LIST_CACHE_TTL_SECONDS`

`BASIC_TIER_DAILY_PROMPT_LIMIT`

`GOOGLE_GEMINI_API_KEY`

`STRIPE_PUBLISHABLE_KEY`

`STRIPE_SECRET_KEY`

`STRIPE_PRO_PRICE_ID`

`STRIPE_WEBHOOK_SECRET`

`CLIENT_URL`


## How to set up and run the project

1. Clone the Repositories

```bash
  git clone https://github.com/Sumit-Saurabh98/kuvaka.git
```
2. Move to project directory

```bash
  cd kuvaka
```
3. install npm packages

```bash
  npm install
```
4. Install Stripe cli (if you do not have)

Follow this link:- https://docs.stripe.com/stripe-cli

5. Login to stripe using cli

```bash
   stripe login
```
6. Get the webhook secret (do not close this terminal)

```bash
   stripe listen --forward-to http://localhost:7002/api/v1/webhook/stripe
```
7. Run Project

```bash
   npm run dev
```
8. Run worker

```bash
   npm run worker:dev
```
#### If server starts successfully, you can see these logs in terminal.

Server is running on port {PORT}

Access it at: http://localhost:{PORT}

Connected to Redis

#### If worker starts successfully, you can see these logs in terminal.

Gemini AI Worker started…

Connected to Redis

## Architecture overview

This backend project follows a modular service-based architecture. It consists of:

Express.js Server — Handles API requests and webhook events.

Redis Queue — Used to queue chat messages and offload processing to background workers.

Worker Script — Listens to Redis queue (BRPOP) and processes AI prompts via Gemini API.

Stripe Integration — Manages subscription lifecycle (checkout, upgrades, cancellations) via Stripe APIs and webhooks.

Prisma ORM + PostgreSQL — Handles all database operations including users, subscriptions, and chat history.

Environment Variables — Used to configure API keys, database URLs, Stripe secrets, and frontend base URLs.

## Queue system explanation

I use Redis' BRPOP command to implement a blocking queue pattern:

Chat requests from users are pushed to a Redis list (LPUSH).

A background worker continuously waits using BRPOP, which blocks until a message arrives.

Once a prompt is received, the worker processes it via Gemini API and stores the AI's response in the database.

This approach ensures scalability, prevents server blocking, and supports real-time processing.

## Gemini API integration overview

The Gemini API is used to generate AI responses for chat prompts in a conversational context.

When a user submits a prompt, it is added to a Redis queue (LPUSH).

A background worker listens to the queue (BRPOP) and processes incoming messages.

Before sending the prompt to Gemini API, the system retrieves the full message history of the chatroom (up to a certain limit) to maintain context and continuity in the conversation.

The full conversation — including past messages and the new user prompt — is sent to Gemini API to generate a coherent and relevant response.

The AI-generated response is stored in PostgreSQL under the associated user and chatroom, along with the original prompt.

Daily usage limits are tracked per user to restrict free-tier access and encourage upgrades to PRO for unlimited usage.

This integration ensures that responses are context-aware, feel natural, and maintain continuity across multiple messages in a chat session.

## Assumptions/design decisions

Key design choices for the Gemini Backend Clone:

Authentication: OTP-based login via mobile number, with JWT for sessions. The design assumes a user must first register via /auth/signup before they can request an OTP for login via /auth/send-otp. This two-step process ensures a clear and secure user flow. Additionally, while the system is primarily OTP-based, routes for password management (/forgot-password, /change-password) have been implemented to align with the provided documentation.

AI Integration: Asynchronous Gemini API calls handled by a Redis Queue and a background worker.

Performance: Redis caching for chatroom lists to reduce database load.

Subscriptions: Stripe integration for Basic/Pro tiers, managed via webhooks and API limits.

Architecture: Modular (controllers, services, routes) using TypeScript for type safety.

Error Handling: Centralized global error handling for consistent API responses.

## How to test via Postman

I have added exported postman collecion in github repositories.
{postman_collection.json}

## Access/deployment instructions

Above i guided to setup project step by step.

I have deployed the app on railway.

this is the root url:- https://web-production-5ca4.up.railway.app

*Health check end point `/healthz`