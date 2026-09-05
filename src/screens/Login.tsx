import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("Couldn't sign in. Check the email and password and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🗣️ Home Biz CRM</div>
        <div style={{ color: "var(--color-text-muted)", marginBottom: 18 }}>Sign in to continue</div>

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="big-button primary" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
