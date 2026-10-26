import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";

export const useAuth = () => {
    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading } = context
    const [ authError, setAuthError ] = useState(null)

    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        setAuthError(null)
        try {
            const data = await login({ email, password })
            if (data?.user) {
                setUser(data.user)
                return { success: true, user: data.user }
            } else {
                const msg = data?.message || "Invalid credentials."
                setAuthError(msg)
                return { success: false, error: msg }
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Login failed. Please verify your connection."
            setAuthError(msg)
            return { success: false, error: msg }
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true)
        setAuthError(null)
        try {
            const data = await register({ username, email, password })
            if (data?.user) {
                setUser(data.user)
                return { success: true, user: data.user }
            } else {
                const msg = data?.message || "Registration failed."
                setAuthError(msg)
                return { success: false, error: msg }
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Registration failed. Please try again."
            setAuthError(msg)
            return { success: false, error: msg }
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
            await logout()
            setUser(null)
        } catch (err) {
            console.error("Logout error:", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const getAndSetUser = async () => {
            try {
                const data = await getMe()
                if (data?.user) {
                    setUser(data.user)
                }
            } catch (err) {
                // Not authenticated
            } finally {
                setLoading(false)
            }
        }

        getAndSetUser()
    }, [])

    return { user, loading, authError, handleRegister, handleLogin, handleLogout }
}