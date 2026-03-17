import { api } from "./baseapi";

export const getPredictedPrice = async (region: string, indicator: string, year: number) => {
    try {
        const response = await api.get("/predict", {
            params: {
                region,
                indicator,
                year
            }
        });
        return response.data;
    } catch(err) {
        console.error("Error in comparision api service: ", err)
    }
}

export const getRegions = async () =>{
    try {
        const response = await api.get("/regions");
        return response.data;
    } catch(err) {
        console.error("Error in fetching regions:", err);
    }
}

export const getIndicators = async () =>{
    try {
        const response = await api.get("/indicators");
        return response.data;
    } catch(err) {
        console.error("Error fetching indicators:", err);
    }
}

export const compareRegions = async (region1: string, region2: string, indicator: string)=>{
    try {
        const response = await api.get("/compare", {
            params: {
                region1,
                region2,
                indicator
            }
        })
        return response.data;
    } catch(err){
        console.error(`Error Comparing Regions ${region1} and ${region2}:`, err)
    }
}