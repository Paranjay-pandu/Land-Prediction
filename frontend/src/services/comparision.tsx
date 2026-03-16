import { api } from "./baseapi";

export const getPredictedPrice = async () => {
    try {
        const response = await api.get("/predict");
        return response.data;
    } catch(err) {
        console.error("Error in comparision api service: ", err)
    }
}