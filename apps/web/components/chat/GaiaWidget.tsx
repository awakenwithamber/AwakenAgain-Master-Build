'use client';
/**
 * Gaia — chatbot popup widget (owner directive 2026-10-10).
 *
 * Behavior per owner spec:
 * - On first visit: popup intro "Hey, my name is Gaia and I'm here to help!"
 * - Small button in the lower-right corner to reopen the chat
 * - Helps visitors find what they need
 */
import { useEffect, useState } from 'react';
import { HerbalChat } from './HerbalChat';

const SEEN_KEY = 'gaia-intro-seen';

export function GaiaWidget() {
  const [open, setOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    // Show intro popup on first visit only.
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        const t = setTimeout(() => setShowIntro(true), 3000);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable — skip intro.
    }
  }, []);

  const dismissIntro = () => {
    setShowIntro(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
  };

  const openChat = () => {
    dismissIntro();
    setOpen(true);
  };

  return (
    <>
      {/* Intro popup */}
      {showIntro && !open && (
        <div
          className="gaia-intro"
          role="dialog"
          aria-label="Meet Gaia"
        >
          <p>
            ✦ Hey, my name is <strong>Gaia</strong> and I&apos;m here to help!
            Ask me about herbs, products, or finding the right remedy for you.
          </p>
          <div className="gaia-intro-actions">
            <button type="button" onClick={openChat}>
              Chat with Gaia
            </button>
            <button type="button" onClick={dismissIntro} aria-label="Dismiss">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div className="gaia-panel" role="dialog" aria-label="Chat with Gaia">
          <button
            type="button"
            className="gaia-close"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
          >
            ✕
          </button>
          <HerbalChat />
        </div>
      )}

      {/* Lower-right button */}
      {!open && (
        <button
          type="button"
          className="gaia-fab"
          onClick={openChat}
          aria-label="Open Gaia chat"
        >
          ✦ Gaia
        </button>
      )}
    </>
  );
}
