import axios from "axios";

export async function fetchAMFIData() {
  const url = "https://www.amfiindia.com/spages/NAVAll.txt";

  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    console.error("Error fetching AMFI data:", error.message);
    throw error;
  }
}
