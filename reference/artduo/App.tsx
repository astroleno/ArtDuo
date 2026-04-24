import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { Gallery } from './components/Gallery';

function App() {
  const [view, setView] = useState<'landing' | 'gallery'>('landing');
  const [userMood, setUserMood] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleStartJourney = (mood: string) => {
    setUserMood(mood);
    setView('gallery');
  };

  return (
    <>
      {view === 'landing' ? (
        <LandingPage 
          onStart={handleStartJourney} 
          isDarkMode={isDarkMode} 
          toggleTheme={toggleTheme} 
        />
      ) : (
        <Gallery 
          isDarkMode={isDarkMode} 
          toggleTheme={toggleTheme} 
          userMood={userMood} 
        />
      )}
    </>
  );
}

export default App;