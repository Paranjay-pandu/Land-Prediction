import { api } from "./baseapi";

class LandPricesAPIService{
    async getPredictedPrice (region: string, indicator: string, year: number) {
        try {
            const response = await api.get("/predict", {params: { region, indicator, year}
            });
            return response.data;
        } catch(err) {
            console.error("Error in api service: ", err)
        }
    }

    async getRegions (){
        try {
            const response = await api.get("/regions");
            return response.data;
        } catch(err) {
            console.error("Error in regions api:", err);
        }
    }

    async getIndicators (){
        try {
            const response = await api.get("/indicators");
            return response.data;
        } catch(err) {
            console.error("Error in indicators api:", err);
        }
    }

    async getIndicatorOptions () {
        try {
            const response = await api.get("/indicators/options")
            return response.data
        } catch(err) {
            console.error("Error getting Indicator options:", err)
        }
    }

    async compareRegions (region1: string, region2: string, indicator: string){
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
            console.error(`Error comparing regions`, err)
        }
    }

    async getSidebarOptions (){
        try{
            const response = await api.get("/options/sidebar");
            return response.data;
        } catch(err) {
            console.error("ERROR getting sidebar options: ", err)
        }
    }
}

export const apiService = new LandPricesAPIService()