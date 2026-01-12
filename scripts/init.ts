import dotenv from "dotenv";

dotenv.config({ quiet: true });

// You know have access to the WORKCONN_API_KEY env var for testing. 

console.log(process.env.WORKCONN_API_KEY);