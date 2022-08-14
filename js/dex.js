// connect to Moralis server
// const serverUrl = "https://nkctkfvsb8yd.usemoralis.com:2053/server";
const appId = "";
const SERVER_URL = process.env.SERVER_URL_KEY;
Moralis.start({ serverUrl, appId });

// API calls
const API_URL_COIN_PAP = "https://api.coinpaprika.com/v1/coins";
const API_URL_1INCH = "https://api.1inch.io/v4.0/137/tokens";

// Initialize plugins
Moralis.initPlugins().then(() => console.log("Plugins have been initialized"));

/* Utilities */
// Convert from Wei functions
// Convert token value to ETH style with 6 decimals
const tokenValueSix = Moralis.Units.FromWei("2000000000000000000", 6);

// Convert token value to ETH style with 18 decimals
// If you do not specify decimals, 18 decimals will be automatically used
const tokenValue = Moralis.Units.FromWei("2000000000000000000");

// assign variables to these html elements so we can refer to them in our functions
const tokenBalanceTBody = document.querySelector(".js-token-balances");
const selectedToken = document.querySelector(".js-from-token");
const amountInput = document.querySelector(".js-from-amount");

/* Login Logout and initialization */
// add from here down
async function login() {
  let user = Moralis.User.current();
  if (!user) {
    user = await Moralis.authenticate();
  }
  console.log("logged in user:", user);
  getStats();
}

const initSwapForm = async (event) => {
  event.preventDefault();

  // this is how we get data with dataset when we click a button - like event.target.value
  // The data-* attributes is used to store custom data private to the page or application.
  selectedToken.innerText = event.target.dataset.symbol;
  selectedToken.dataset.address = event.target.dataset.address;
  selectedToken.dataset.decimals = event.target.dataset.decimals;
  selectedToken.dataset.max = event.target.dataset.max;

  // enable input amount in form input field
  amountInput.removeAttribute("disabled");
  // clear a value if it has one
  amountInput.value = "";
  // change disable attribute and clear the results
  document.querySelector("js-submit").removeAttribute("disabled");
  document.querySelector("js-cancel").removeAttribute("disabled");
  document.querySelecto(".js-quote-container").innerHTML = "";
  document.querySelector(".js-amount-error").innerText = "";
};

// get all token balances of current user specified address
const getStats = async () => {
  const balances = await Moralis.Web3API.account.getTokenBalances({
    chain: "polygon",
  });
  console.log(balances);
  tokenBalanceTBody.innerHTML = balances
    .map((token, index) => {
      `<tr>
      <td>${index + 1}</td>
      <td>${token.symbol}</td>
      <td>${tokenValue(token.balance, token.decimals)}</td>
      <td><button 
            class='js-swap btn btn-success'
            // add data attributes to get the address of the tokens we click on 
            data-address='${token.token_address}'
            data-symbol='${token.symbol}'
            data-decimals='${token.decimals}'
            data-max='${tokenValue(token.balance, token.decimals)}'
            >
            Swap
          </button>
      </td>
    </tr>`;
    })
    .join("");

  // make sure the clicks are listened to
  // pass this event for each button with a class js-swap
  for (let $btn of tokenBalanceTBody.querySelectorAll(".js-swap")) {
    $btn.addEventListener("click", initSwapForm);
  }
};

// set buy crypto function with onramper plugin
const buyCrypto = async () => {
  Moralis.Plugins.fiat.buy();
};

async function logOut() {
  await Moralis.User.logOut();
  console.log("logged out");
}

document.querySelector("#btn-login").addEventListener("click", login);
document.querySelector("#btn-buy-crypto").addEventListener("click", buyCrypto);
document.querySelector("#btn-logout").addEventListener("click", logOut);

/* Quote / Swap */
const formSubmitted = async (event) => {
  event.preventDefault();

  const fromAmount = Number.parseFloat(amountInput.value);
  const fromMaxValue = Number.parseFloat(selectedToken.dataset.max);

  if (Number.isNaN(fromAmount) || fromAmount > fromMaxValue) {
    // invalid input
    document.querySelector(".js-amount-error").innerText = "Invalid amount";
    return;
  } else {
    document.querySelector(".js-amount-error").innerText = "";
  }

  /* Quote request submission */
  // to perform the swap trx replace the quote code for the swap code from moralis website
  // fromDecimals converts the amount back to wei
  const fromDecimals = selectedToken.dataset.decimals;
  const fromAddress = selectedToken.dataset.address;

  // destructure the values from the renderDropDown function below
  const [toAddress, toDecimals] = document
    .querySelector("[name=to-token]")
    .value.split("-");

  try {
    const quote = await Moralis.Plugins.oneInch.quote({
      chain: "polygon",
      // The blockchain you want to use (eth/bsc/polygon)
      fromTokenAddress: fromTokenAddress,
      // or use shorthand with only one
      // The token you want to swap
      toTokenAddress: toTokenAddress,
      // The token you want to receive
      amount: Moralis.Units.Token(fromAmount, fromDecimals).toString(),
    });
    console.log(quote);

    // convert to Wei from token value
    const toAmount = tokenValue(quote.toTokenAmount, toDecimals);
    document.querySelector(".js-quote-container").innerHTML = `
    <p>${fromAmount} ${quote.fromToken.symbol} = ${toAmount} ${quote.toToken.symbol}</p>
    <p>Gas fee: ${quote.estimatedGas}</p>
  `;
  } catch (error) {
    document.querySelector(".js-quote-container").innerHTML = `
    <p class='error'>The conversion didn't succed.</p>
  `;
  }
};
const formCanceled = async (event) => {
  event.preventDefault();

  // set input values to disabled and clear all data
  document.querySelector(".js-submit").setAttribute("disabled", "");
  document.querySelector(".js-cancel").setAttribute("disabled", "");
  amountInput.value = "";
  amountInput.setAttribute("disabled", "");
  document.querySelecto(".js-quote-container").innerHTML = "";
  document.querySelector(".js-amount-error").innerText = "";

  // delete input attributes with the delete operator
  delete selectedToken.dataset.address;
  delete selectedToken.dataset.decimals;
  delete selectedToken.dataset.max;
};

document.querySelector(".js-submit").addEventListener("click", formSubmitted);
document.querySelector(".js-cancel").addEventListener("click", formCanceled);

/* to token dropdown */
const getTop10Tokens = async () => {
  try {
    const response = await fetch(API_URL_COIN_PAP);
    const tokens = await response.json();

    return tokens
      .filter((token) => token.rank >= 1 && token.rank <= 30)
      .map((token) => token.symbol);
  } catch (error) {
    console.log(error);
  }
};

// get 1inch ticker addresses
// the tickerList parameter data is passed as argument from our functions call in line 145...
const getTickerData = async (tickerList) => {
  try {
    const tokens = await Moralis.Plugins.oneInch.getSupportedTokens({
      chain: "polygon", // The blockchain you want to use (eth/bsc/polygon)
    });
    console.log(tokens);

    // we don't need this after adding the 1Inch plugin aggregator
    // const response = await fetch(API_URL_1INCH);
    // const tokens = await response.json();
    const tokenList = Object.values(tokens.tokens);

    // console.log(tokenList);
    return tokenList.filter((token) => tickerList.includes(token.symbol));
  } catch (error) {
    console.log(error);
  }
};

// the tokens parameter data is passed as argument from our functions call in line 145...
const renderTokenDropdown = async (tokens) => {
  const options = tokens
    .map(
      (token) => `
    <option value='${token.address}-${token.decimals}'>
      ${token.name}
    </option>
    `
    )
    // we use join so the result array doesn't display ,s
    .join("");
  document.querySelector("[name=to-token]").innerHTML = options;
};

getTop10Tokens()
  .then(getTickerData)
  // .then(console.log());
  .then(renderTokenDropdown);
