# Defence

What the code scanner found on Workflow Scout, what we fixed, what we left and why. Written for the judges, in plain words. The two choices under "Why" were made deliberately before the scan and hold whatever the scanner says.

## Fixed

PENDING: the scanner has not been run yet. One line goes here per rule we fixed, in the form "Fixed: [rule] in [file]".

## Left

PENDING: the scanner has not been run yet. One line goes here per rule we left, in the form "Left: [rule] in [file]", each with a sentence saying why it is safe to leave for a hackathon demo.

## Why

**Personal links instead of passwords.** There are no passwords anywhere in Workflow Scout. Each person has one secret link, which arrives in their morning email; opening it sets a signed, http only session cookie holding who they are and whether they are a manager. We chose this because the product has to work in one tap from a phone at 08:00, and because a password nobody wants would be the reason people stop doing their check in. The trade off is real and we state it: anyone holding the link is that person until the cookie is cleared. What makes that acceptable here is that the link gives no more than the person's own days. Every server route checks the session before it reads anything: an employee can read and change only their own check ins, a manager only the people whose manager is them. For a real deployment the next step is one sign in through the company's own identity provider, with the link kept only as the way into a single day.

**The service key stays on the server and inside make.com, and the database has no public access.** Only two things ever hold the Supabase service key: our own Next.js server, and the make.com connections. The browser holds none of it: no database key, no webhook address, no voice key. Row level security is on across the database with no policies for the anonymous role, so a key that did leak into a page would still read nothing. Every read the server makes is filtered by who is signed in, in one place rather than screen by screen. We chose the service key over per user database credentials because the agent itself is a make.com scenario rather than a signed in person, and two keys for one job is how keys get left in the wrong place.
