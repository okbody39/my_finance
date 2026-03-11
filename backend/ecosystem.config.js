module.exports = {
    apps: [
        {
            name: "wolchun-app",
            script: "./server.js",
            watch: false,
            env: {
                NODE_ENV: "production",
                // PORT: 4000 // (Optional) Change port here if needed
            }
        }
    ]
};
