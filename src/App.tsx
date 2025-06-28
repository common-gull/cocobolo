import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface AppInfo {
  name: string;
  version: string;
  description: string;
}

function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppInfo();
  }, []);

  async function loadAppInfo() {
    try {
      setLoading(true);
      const info = await invoke<AppInfo>("get_app_info");
      setAppInfo(info);
      setError("");
    } catch (err) {
      setError(`Failed to load app info: ${err}`);
      console.error("Error loading app info:", err);
    } finally {
      setLoading(false);
    }
  }

  async function greet() {
    try {
      setError("");
      const message = await invoke<string>("greet", { name });
      setGreetMsg(message);
    } catch (err) {
      setError(`Greeting failed: ${err}`);
      setGreetMsg("");
      console.error("Error greeting:", err);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="loading">Loading...</div>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="app-header">
        <h1>{appInfo?.name || "Cocobolo"}</h1>
        <p className="app-description">{appInfo?.description}</p>
        <p className="app-version">Version: {appInfo?.version}</p>
      </header>

      <section className="welcome-section">
        <h2>Welcome to Your Secure Note-Taking Application</h2>
        <p>
          This is the foundation of your encrypted, cross-platform note-taking experience.
          Built with security and privacy in mind.
        </p>
      </section>

      <section className="demo-section">
        <h3>Test the Backend Connection</h3>
        <form
          className="greet-form"
          onSubmit={(e) => {
            e.preventDefault();
            greet();
          }}
        >
          <input
            id="greet-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter your name..."
            required
          />
          <button type="submit">Say Hello</button>
        </form>
        
        {error && <div className="error-message">{error}</div>}
        {greetMsg && <div className="success-message">{greetMsg}</div>}
      </section>

      <footer className="app-footer">
        <p>🔒 Security First • 🚀 Cross-Platform • 📝 Markdown Support</p>
      </footer>
    </main>
  );
}

export default App;
