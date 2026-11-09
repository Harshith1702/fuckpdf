import React, { useEffect } from "react";

export const App: React.FC = () => {
  useEffect(() => {
    window.location.replace("https://boringpdf.app" + (window.location.search || "") + (window.location.hash || ""));
  }, []);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        backgroundColor: "#ffffff",
        color: "#0f172a",
      }}
    >
      <div style={{ textAlign: "center", padding: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>Redirecting...</h1>
        <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
          If you are not redirected automatically, please visit{" "}
          <a
            href="https://boringpdf.app"
            style={{ color: "#0f172a", fontWeight: 600, textDecoration: "underline" }}
          >
            boringpdf.app
          </a>
        </p>
      </div>
    </div>
  );
};
