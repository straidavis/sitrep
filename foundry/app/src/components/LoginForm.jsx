import React, { useState } from 'react';
import { LogIn } from 'lucide-react';

const LoginForm = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await onLogin(email, password);
            if (res && !res.success) {
                setError(res.message);
            }
        } catch (err) {
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
                    <LogIn size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">S.P.A.R.K. Login</h2>
                <p className="text-muted mb-4">
                    Enter your credentials to sign in.
                </p>
            </div>

            {error && <div className="text-error text-sm text-center bg-error/10 p-2 rounded">{error}</div>}

            <div className="form-group">
                <label className="form-label">Email / Username</label>
                <input
                    type="text"
                    className="input w-full"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                />
            </div>

            <div className="form-group">
                <label className="form-label">Password</label>
                <input
                    type="password"
                    className="input w-full"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
            </div>

            <button
                type="submit"
                className="btn btn-primary w-full py-3 h-auto text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 mt-2"
                disabled={loading}
            >
                {loading ? 'Signing In...' : 'Sign In'}
            </button>
        </form>
    );
};

export default LoginForm;
