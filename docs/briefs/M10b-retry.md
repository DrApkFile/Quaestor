# M10b retry amendment — builder, 25 November 2026

The builder explicitly authorized the following after the first attempt timed out:

> Push 0896ff0 (keep the failed attempt on record). Then raise the funding wait in the M10 signup runner to 60 minutes and make it print the address prominently, plus a reminder line every 2 minutes. Commit, push. Then start a new pnpm evidence --m10-fresh-signup run against https://use-quaestor.vercel.app as in docs/M10-SIGNUP.md. It's a new account and a new uninterrupted attempt. Print the address and wait for me.

The existing failed session is preserved. The new CLI invocation receives a distinct attempt ID, guarded private directory and screenshot prefix. Funding remains manual; timeout/refusal still stops without alternate funding. The 90-minute overall timeout permits the full 60-minute funding wait. No application, protocol, crypto or contract behaviour changes are authorized by this amendment.
