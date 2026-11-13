// API URL
// const apiurl = "https://cycluster.mpim-bonn.mpg.de/api";
// const apiurl = "http://localhost:9090/api";

console.log(apiurl);

// example query to be filled into the search form
var rules_example = {
    condition: 'AND',
    rules: [{
	id: 'degz',
	operator: 'equal',
	value: '14'
    }, {
	id: 'lexp_list',
	operator: 'contains',
	value: "0,1,1,2;4,4,4,4"
    }]
};

// definition of the search form an its available options
// for documentation see https://querybuilder.js.org/
$('#operatorSearch').queryBuilder({
    filters: [{
	id: "nn",
	type: "string",
	label: "New Number",
	placeholder: '__.__.__',
	operators: ['equal'],
	validation: {
	    format: /^[0-9]+\.[0-9]+\.[0-9]+$/
	}
    },{
	id: "aesz",
	type: "string",
	label: "AESZ Label",
	operators: ['equal', 'like'],
    },{
	id: "inst_list",
	type: "string",
	label: "Normalized instantons",
	operators: ['contains', 'overlaps', 'nth_elem_is'],
    },{
	id: "lexp_list",
	type: "string",
	label: "Local exponents",
	operators: ['contains', 'overlaps', 'nth_elem_is'],
    },{
	id: "sol_list",
	type: "string",
	label: "Coeff. hol. solution",
	operators: ['contains', 'overlaps', 'nth_elem_is'],
    },{
	id: "degz",
	type: "integer",
	label: "z degree",
	operators: ['equal'],
    },{
	id: "degtheta",
	type: "integer",
	label: "&theta; degree",
	operators: ['equal'],
    },{
	id: "c3",
	type: "integer",
	label: "Euler char. c&#x2083;",
	operators: ['equal'],
    },{
	id: "c2h",
	type: "integer",
	label: "c&#x2082; &#x2027; H",
	operators: ['equal'],
    },{
	id: "h3",
	type: "integer",
	label: "Triple int. number H&#x00B3;",
	operators: ['equal'],
    },{
	id: "dim_h",
	type: "integer",
	label: "Dim. of linear system |H|",
	operators: ['equal'],
    },{
	id: "description",
	type: "string",
	label: "Description & remarks",
	operators: ['like'],
    }],
    operators: [
	'equal',
	'not_equal',
	'in',
	'not_in',
	'contains',
	'not_contains',
	'is_empty',
	'is_not_empty',
	'is_null',
	'is_not_null',
	{
	    type: 'overlaps',
	    nb_inputs: 1,
	    multiple: false,
	    apply_to: ['string']
	},
	{
	    type: 'nth_elem_is',
	    nb_inputs: 2,
	    multiple: false,
	    apply_to: ['string', 'number']
	},
	{
	    type: 'like',
	    nb_inputs: 1,
	    multiple: false,
	    apply_to: ['string']
	}],
    rules: rules_example
});

// this function translates form data into a PostgREST API request
// the level tracks how deep we're nested inside AND/OR groups
function query2REST(query, level) {

    var result = '';

    // console.log('%o', query);

    if(query.condition) {  // handle group

	var sep = (level == 0) ? '=' : '';

	if(!query.rules) {
	    return '';
	}

	result += query.condition.toLowerCase() + sep + '(';
	result += query.rules.map(rule => query2REST(rule, level+1)).join(',');
	result += ')';

    } else {  // handle single rules

	// inside groups API filters use field.op., not field=op.
	var sep = (level == 0) ? '=' : '.';

	// local exponents are lists of lists,
	// therefore use ; as list split character
	var splt = (query.field == 'lexp_list') ? ';' : ',';

	switch(query.operator) {
	case 'equal':
	    result += query.field + sep + 'eq.' + query.value;
	    break;
	case 'like':
	    result += query.field + sep + 'ilike.*' + query.value + '*';
	    break;
	case 'overlaps':
	    result += query.field + sep + 'ov.{"';
	    result += query.value.replaceAll(" ","").split(splt).join('","');
	    result += '"}';
	    break;
	case 'contains':
	    result += query.field + sep + 'cs.{"';
	    result += query.value.replaceAll(" ","").split(splt).join('","');
	    result += '"}';
	    break;
	case 'nth_elem_is':
	    var qte = (level > 0) ? '"' : '';
	    result += query.field + '->>' + query.value[0].replaceAll(" ","") + sep + 'eq.';
	    result += qte + query.value[1].replaceAll(" ","") + qte;
	    break;
	}
    }

    return result;

}

// this function is called when the search button (or enter) is pressed
function callAPI() {
    var result = $('#operatorSearch').queryBuilder('getRules');

    if (!$.isEmptyObject(result)) {
	// alert(JSON.stringify(result, null, 2));
	// alert(query2REST(result, 0));

	// Provide immediate user feedback while loading
	const resultsDiv = document.getElementById('operatorResults');
	resultsDiv.innerHTML = '<h1>Loading...</h1>';

	// Query the PostGREST API
	var queryURL = `${apiurl}/operators?select=nn,aesz,operator_tex&` + query2REST(result, 0);
	let request = preview ? getCatalogue().then(rows => rows.filter(row => matchesRule(row, result))) :
	    fetch(queryURL).then(response => {
		if (!response.ok) {
		    throw new Error('Network response was not ok.\n' + queryURL);
		}
		return response.json();
	    });
	request
            .then(data => {

		if (data.length === 0) {
		    resultsDiv.innerHTML = '<h1>No results found.</h1>';
		    return;
		}

		// display data with EJS template
		    resultsDiv.innerHTML = ejs.render('<h1>Results: <%= items.length %></h1>' +
						  '<table class="table table-bordered table-striped"><tr>' +
						  '<th>New Number</th><th>AESZ Label</th><th>Operator</th></tr>' +
						  '<% for(let i=0; i<items.length; i++) { %><tr>' +
						  '<td><a href="<%= operatorLink(items[i].nn) %>"><%= items[i].nn %></a></td>' +
						  '<td><%= items[i].aesz %></td>' +
						  '<td>\\(<%= items[i].operator_tex.replace(/ /g,"\\\\ "); %>\\)</td>' +
						  '</tr><% } %></table>' +
						  '<% if (!preview) { %><p>Corresponding API call:</p><div class="code-copy-outer-scaffold"><div class="sourceCode"><pre class="sourceCode bash code-with-copy"><code class="sourceCode bash"><span class="ex">curl</span> <span class="va">\'<%= url %>\'</span></code></pre></div><button title="Copy to Clipboard" class="code-copy-button"><i class="bi"></i></button></div><% } %>',
						  {items: data, url: encodeURI(queryURL), preview: preview, operatorLink: operatorLink});
		// process Latex
		renderMathInElement(resultsDiv);

	    })
            .catch(error => {
		console.error('Error fetching data:', error);
		resultsDiv.innerHTML = `<p>Error: ${error.message}</p>`;
            });
    }
}


// the Reset button clears the form
$('#btn-reset').on('click', function() {
    $('#operatorSearch').queryBuilder('reset');
});

// the Example button fills the form with an example
$('#btn-set').on('click', function() {
    $('#operatorSearch').queryBuilder('setRules', rules_example);
});

// the Search button triggers an API call and renders the results
$('#btn-get').on('click', callAPI);

// pressing Enter inside the form also triggers an API call
// and renders the results
$('#operatorSearch').on('keyup', (event) => {
    if (event.key === 'Enter') {
	event.preventDefault(); // Optional: Prevent default behavior (e.g., form submission)
	callAPI();
    }
});
