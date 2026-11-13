// API URL
// const apiurl = "https://cycluster.mpim-bonn.mpg.de/api";
// const apiurl = "http://localhost:9090/api";

// load key descriptions
const keylabels = {
    "nn": "NewNumber (Degree in \\( \\theta \\) . Degree in \\( z \\) . Label)",
    "aesz": "AESZ Number",
    "description": "Description and remarks",
    "pols_list": "Polynomials in \\( \\theta \\) for each order of \\( z \\) variable in the operator",
    "degz": "Degree in \\( z \\)",
    "degtheta": "Degree in \\( \\theta \\)",
    "operator_tex": "Operator TeX Format",
    "c3": "Euler Characteristic \\( c_3 \\) ",
    "c2h": "Integral over second Chern Class times hyperplane class \\( c_2 \\cdot H\\)",
    "h3": "Triple Intersection Number \\( H^3 \\)",
    "dim_h": "Dimension of the linear system \\( |H| \\) corresponding to the hyperplane class",
    "sol_list": "Coefficients of the holomorphic solution \\( \\varpi_0(z) \\) at \\( z=0 \\)",
    "sol_explicit_tex": "Closed expression for the series coefficients",
    "zq_list": "Coefficients of the Mirror Map \\( z(q)\\)",
    "qz_list": "Coefficients of the Inverse Mirror Map \\( q(z) \\)",
    "yuk_list": "Coefficients of the Yukawa coupling expansion",
    "yuk_alg": "Algebraic Expression for the Yukawa coupling \\( Y_{zzz}(z) \\)",
    "inst_list": "Normalized instanton numbers",
    "discriminant_list": "Coefficients of the disciminant",
    "discriminant_tex": "Discriminant TeX Format",
    "riemann": "Riemann Symbol",
    "sings": "Singularities of the operator",
    "frobenius_solutions": "Solutions in Frobenius Basis",
    "transition_matrices": "Transition Matrices",
    "integral_monodromies": "Integral Monodromy Matrices",
    "attractor_points": "Attractor points"
};

// add math delimiters to a string
function tex(mathstr) {
    if(mathstr !== null) {
    return    '\\(' + mathstr + '\\)'; 
    } else {
    return '';
    }
}

// function to format a series
function texSeries(coeff, prm) {

    if(coeff.length > 0) {
	
	let series = '\\(';
	let first = true;
	
	for(let i = 0; i < Math.min(coeff.length, 7); i++) {
	    let value = String(coeff[i]);
	    let power = (i==0) ? '' : (i==1) ? prm : prm+'^{'+i+'}';
	    if ( value !== '0' ) {
		let op = value.charAt(0) === '-' ? '' : '+';
		if (i && value === '1') series += (first ? '' : op) + power;
		else if (i && value === '-1') series += '-' + power;
		else series += (first ? '' : op) + numberTex(value) + power;
		first = false;
	    }
	}
	if (coeff.length > 7) series += '+\\cdots';

	series += '\\)';

	return series;

    } else {
	return '';
    }
}

// function to format a Riemann symbol
function texRiemann(riemanndat) {

    if(riemanndat !== null) {

	let riemanntex = '\\( \\begin{Bmatrix}';

	riemanntex += riemanndat
	.map((x) => x.sing_tex || x.sing)
	    .join(" & ")
	    .replace("infinity","\\infty");
	riemanntex += '\\\\';
	riemanntex += '\\hline';

	for (let i = 0; i < riemanndat[0].lexp.length; i++) {
	    riemanntex += riemanndat
		.map((x) => x.lexp_tex?.[i] || x.lexp[i])
		.join(" & ");
	    riemanntex += '\\\\'
	}

	riemanntex += '\\end{Bmatrix} \\)';

	return riemanntex;
    } else {
	return "";
    }
}

// function to format a matrix (=list of lists)
function texMatrix(mat) {

    if(mat !== null) {

	let mattex = '\\begin{pmatrix}';
	mattex += mat.map((r) => r.join(" & ")).join("\\\\");
	mattex += '\\end{pmatrix}';

	return mattex;

    } else {
	return "";
    }

}

// find the results div
const resultsDiv = document.getElementById('operator');

// get & check URL parameters
const URLparams = new URLSearchParams(window.location.search);
const nnpatt = /^[0-9]+\.[0-9]+\.[0-9]+$/;
let opnn = URLparams.get("nn");

if(!nnpatt.test(opnn)) {

    // Explain usage if operator id is missing
    resultsDiv.innerHTML = `<h2>Operator number missing!</h2><p>Try ${window.location.href}?nn=x.y.z</p>`;

} else {

    // Query the PostGREST API for the operator
    // the select= defines which keys of an operator to retrieve and their order
    // the iq=eq. defines which operator to retrieve
    const params = ['select=nn,aesz,description,operator_tex,riemann,c3,c2h,h3,dim_h,discriminant_tex,inst_list,pols_list,sol_list,sol_explicit_tex,yuk_alg,yuk_list,zq_list,qz_list,attractor_points,surfaces'];
    params.push(`nn=eq.${opnn}`);

    getOperator(opnn)
	.then(async data => {

	    if (data.length === 0) {
		resultsDiv.innerHTML = '<h2>Operator not found.</h2>';
		return;
	    }

	    for (const key of ["inst_list", "sol_list", "zq_list", "qz_list", "yuk_list"]) {
		data[0][key] ||= [];
	    }
	    data[0].surfaces ||= [];
	    // get template from html
	    const tmplt = document.getElementById('optmplt');

	    // display data with EJS template
	    resultsDiv.innerHTML = ejs.render(
		tmplt.innerHTML.replace(/&(amp|lt|gt|quot|#39);/g, (m, p) => {
		    return {'amp':'&', 'lt':'<', 'gt':'>', 'quot':'"', '#39':"'"}[p];
		}), {oper: data[0]});

	    try {
		await renderExtra(data[0]);
	    } catch (error) {
		console.error('Error loading supplementary data:', error);
		document.getElementById('extra-data').textContent = `Supplementary data could not be loaded: ${error.message}`;
	    }

	    // process Latex
	    renderMathInElement(resultsDiv, {
		delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
		],
		// throwOnError : false
            });


	    // load snippet that should get a copy button
	    var snippets = document.querySelectorAll('.snippet');

	    // insert copy buttons
	    [].forEach.call(snippets, function(snippet) {
		snippet.firstElementChild.insertAdjacentHTML('beforebegin',
							     '<button class="btn" data-clipboard-snippet>' +
							     '<img src="files/copy-button.svg" alt="Copy to clipboard">' +
							     '</button>');
	    });

	    // setup event handlers for the copy bottons
	    var clipboardSnippets = new ClipboardJS('[data-clipboard-snippet]', {
		target: function(trigger) {
		    return trigger.nextElementSibling;
		},
		text: function(trigger) {
		    return trigger.nextElementSibling.getAttribute('data-clipboard-text');
		}
	    });

	    // helper for tooltips
	    function clearTooltip(e) {
		e.currentTarget.setAttribute('class', 'btn');
		e.currentTarget.removeAttribute('aria-label');
	    }

	    // helper for tooltips
	    function showTooltip(elem, msg) {
		elem.setAttribute('class', 'btn tooltipped tooltipped-s');
		elem.setAttribute('aria-label', msg);
	    }

	    // show tooltip on successful copy
	    clipboardSnippets.on('success', function(e) {
		e.clearSelection();

		showTooltip(e.trigger, 'Copied!');
	    });

	    // show tooltip error
	    clipboardSnippets.on('error', function(e) {
		showTooltip(e.trigger, 'Something went wrong ... :(');
	    });

	    // add event listeners to clear tooltips
	    var btns = document.querySelectorAll('.btn');

	    for (var i = 0; i < btns.length; i++) {
		btns[i].addEventListener('mouseleave', clearTooltip);
		btns[i].addEventListener('blur', clearTooltip);
	    }


	})
	.catch(error => {
	    console.error('Error fetching data:', error);
	    resultsDiv.innerHTML = `<p>Error: ${error.message}</p>`;
	});
}
