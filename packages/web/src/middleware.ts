import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/landing(.*)', '/sign-in(.*)', '/sign-up(.*)', '/api/webhook(.*)', '/api/chat(.*)', '/api/me(.*)', '/api/artifacts(.*)', '/api/files(.*)', '/api/watchlist(.*)', '/api/schedule(.*)', '/api/personality(.*)', '/api/agent(.*)', '/api/marketplace(.*)', '/api/connectors(.*)', '/api/procore(.*)', '/preview(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'],
};
