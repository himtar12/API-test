function checkStatusCode(requestParams,response, context, ee, next){
const successCode = 200;
  if(response.statusCode !== successCode){
    const err = new Error();
    err.message += `Expected response code 200 but got ${response.statusCode} for the below request: \n &#xA; ${requestParams.url} `;
    return next(err);
  }
  return next();
}

function countCurrency(requestParams,response, context, ee, next) {
  const res = JSON.parse(response.body);
  const currencies = Object.keys(res.conversion_rates);
  const totalCurrencies = currencies.length;

  if(!totalCurrencies){
    const err = new Error(`Actual: There are no currencies`);
    return next(err);
  }
  
  return next(new Error(`Total Currencies are: ${totalCurrencies}`));
}

function currencyCheckForGBP(requestParams,response, context, ee, next) {
  const res = JSON.parse(response.body);
  const currencies = Object.keys(res.conversion_rates);

  if(!currencies.includes('GBP')){
    const err = new Error(`Actual: GBP currency is not present`);
    return next(err);
  }
  
  return next();
}

module.exports = {
  checkStatusCode,
  countCurrency,
  currencyCheckForGBP
}
