import config from "../config";
import axios from "axios/lib/axios";

export const queryFeeThroughSidecar = async (transaction) => {
    const estimates = await fetchSideCar('transaction/fee-estimate', {"tx": transaction});
    const fee = api.registry.createType('Balance', estimates.partialFee);
    return fee.toHuman();
}

const fetchSideCar = async (uri, jsonBody) => {
    const sideCarUrl = config.SIDECAR_URL + uri;
    console.log('Sending sidecar request to ' + sideCarUrl);
    const response = await axios.post(sideCarUrl, jsonBody);
    return response.data;
}
