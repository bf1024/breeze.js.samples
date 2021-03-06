// ReSharper disable UnusedParameter
// ReSharper disable InconsistentNaming
(function (testFns) {
    "use strict";

    /*********************************************************
    * Breeze configuration and module setup
    *********************************************************/
    var handleFail = testFns.handleFail;
    var EntityQuery = breeze.EntityQuery;
    var EntityType = breeze.EntityType;
    var FilterQueryOp = breeze.FilterQueryOp;
    var Predicate = breeze.Predicate;
    var UNCHANGED = breeze.EntityState.Unchanged;

    // We'll use this "alfred's predicate" a lot
    // e.g. to find Orders that belong to the Alfred's customer
    var alfredsID = testFns.wellKnownData.alfredsID;
    var alfredsPredicate =
        Predicate.create("CustomerID", "==", alfredsID);

    var verifyQuery = testFns.verifyQuery;

    var runQuery = testFns.runQuery;
    var queryForOne = testFns.queryForOne;
    var queryForNone = testFns.queryForNone;
    var queryForSome = testFns.queryForSome;

    // Asserts merely to display data
    var showCustomerResults = testFns.showCustomerResultsAsAssert;

    var serviceName = testFns.northwindServiceName;
    var newEm = testFns.newEmFactory(serviceName);

    module("queryTests (single condition)", testFns.getModuleOptions(newEm));

    /*********************************************************
    * all customers - test suite "concise" style
    * execute the query via a test helper method
    * that encapsulates the ceremony
    *********************************************************/
    test("all customers (concise)", function () {
        expect(1);
        var query = EntityQuery.from("Customers"); // Create query style #1

        verifyQuery(newEm, query, "all customers");
    });

    /*********************************************************
    * all customers - promises style
    *********************************************************/
    test("all customers (promises)", function () {
        expect(1);
        var query = new EntityQuery("Customers"); // Create query style #2

        stop();                     // going async ... tell testrunner to wait
        newEm().executeQuery(query)
          .then(assertGotCustomers) // success callback
          .fail(handleFail)         // failure callback
          .fin(start);              // "fin" always called.
    });

    function assertGotCustomers(data) {
        var count = data.results.length;
        ok(count > 0, "customer query returned " + count);
    }

    /*********************************************************
    * all customers - callback style
    *********************************************************/
    test("all customers (callbacks)", function () {
        expect(1);
        var query = new EntityQuery().from("Customers"); // Create query style #3

        stop();                 // going async ... tell testrunner to wait
        newEm().executeQuery(query,
            function (data) {   // success callback
                assertGotCustomers(data);
                start();        // resume testrunner
            },
            handleFail        // failure callback
        );
    });

    /*********************************************************
    * Custom timeout cancels 'all customers' query
    * The server may or maynot complete the query but the
    * query has timedout from the client perspective.
    *********************************************************/
    test("custom timeout cancels 'all customers' query", function () {
        expect(1);
        var timeoutMs = 1; // ridiculously short ... should time out
            allCustomerTimeoutQuery(timeoutMs, true);
        });
    /*********************************************************
   * 'all customers' query completes before custom timeout
   * This timeout governs the callbacks. It doesn't stop
   * the server from sending the data nor does it stop
   * the Breeze EntityManager from processing a response
   * that arrives after this promise is resolved.
   * If you need that, see the jQueryAdapterTests.
   *********************************************************/
    test("'all customers' query completes before custom timeout", function () {
        expect(1);
        var timeoutMs = 100000; // ridiculously long ... should succeed
            allCustomerTimeoutQuery(timeoutMs, false);
        });
    function allCustomerTimeoutQuery (timeoutMs, shouldTimeout) {

        var expectTimeoutMsg = shouldTimeout ?
            " when should timeout." : " when should not timeout.";

        var em = newEm();
        var query = new EntityQuery().from("Customers").using(em);

        stop(); // going async ... tell testrunner to wait

        Q.timeout(query.execute(), timeoutMs)
            .then(queryFinishedBeforeTimeout)
            .fail(queryTimedout)
            .fin(start);

        function queryFinishedBeforeTimeout(data) {
            var count = data.results.length;
            ok(!shouldTimeout,
                "Query succeeded and got {0} records; {1}.".
                format(count, expectTimeoutMsg));
        }

        function queryTimedout(error) {
            var expect = /timed out/i;
            var emsg = error.message;
            if (expect.test(emsg)) {
                ok(shouldTimeout,
                    ("Query timed out w/ message '{0}' " + expectTimeoutMsg)
                    .format(emsg));
            } else {
                handleFail(error);
            }
        }
    }
    asyncTest("can query for suppliers which holds a complex type", function () {
        expect(2);
        var em = newEm();

        EntityQuery.from('Suppliers').top(1)
            .using(em).execute()
            .then(success).fail(handleFail).fin(start);

        function success(data) {
            var address=null, hasAddress = false;
            var supplier = data.results[0];
            ok(supplier != null, "should have a supplier");
            try {
                address = supplier && supplier.Location().Address();
                hasAddress = address && address.length;
            } catch (e) { /*will catch error in failed test*/ }
            ok(hasAddress, "should have supplier.location.address which is " + address);
        }
    });
    /*** Single condition filtering ***/

    /*********************************************************
    * customers starting w/ 'A' (string comparison)
    *********************************************************/
    test("customers starting w/ 'A' ", function () {
        expect(2);
        // query for customer starting with 'A', sorted by name
        var query = EntityQuery.from("Customers")
            .where("CompanyName", FilterQueryOp.StartsWith, "A")
        //  .where("CompanyName", "startsWith", "A") // alternative to FilterQueryOp
        .orderBy("CompanyName");

        verifyQuery(newEm, query, "customers starting w/ 'A'",
            showCustomerResults);
    });

    /*********************************************************
    * orders with freight cost over 100.
    *********************************************************/
    test("orders with freight cost over 100", function () {
        expect(1);
        var query = EntityQuery.from("Orders")

            .where("Freight", FilterQueryOp.GreaterThan, 100);
        //  .where("Freight", ">", 100); // alternative to FilterQueryOp
        //  .where("Freight", "greaterThan", 100); // using the name of the FilterQueryOp itself


        verifyQuery(newEm, query, "freight orders query");
    });

    /*********************************************************
    * orders placed on or after 1/1/1998.
    *********************************************************/
    test("orders placed on or after 1/1/1998", function () {
        expect(1);
        // Make sure date is in UTC (like the datetimes in the database)
        var testDate = new Date(Date.UTC(1998, 0, 1)); // month counts from zero!

        var query = EntityQuery.from("Orders")
            .where("OrderDate", FilterQueryOp.GreaterThanOrEqual, testDate);
        //  .where("OrderDate", ">=", testDate); // alternative to FilterQueryOp
        //  .where("OrderDate", "GreaterThanOrEqual", testDate);

        verifyQuery(newEm, query, "date orders query");
    });
    /*********************************************************
    * orders placed on or after 1/1/1998, using moment.js
    * This query mimics on in Brian Noyce' PluralSight course
    * both in using moment.js AND in using the FilterQueryOp's symbol name
    *********************************************************/
    test("orders placed on or after 1/1/1998 (using moment.js)", function () {
        expect(1);
        // Make sure date is in UTC (like the datetimes in the database)
        var testDate = moment.utc([1998, 0, 1]); // month counts from zero!

        var query = EntityQuery.from("Orders")
            .where("OrderDate", "GreaterThanOrEqual", testDate);
        verifyQuery(newEm, query, "date orders query");
    });
    /*********************************************************
    * no orders placed exactly on 1/1/1998 at 9am GMT.
    *********************************************************/
    test("orders placed on 1/1/1998 at 9am GMT", function () {
        expect(1);
        // Make sure date is in UTC (like the datetimes in the database)
        var testDate = new Date(Date.UTC(1998, 0, 1, 9)); // month counts from zero!

        var query = EntityQuery.from("Orders")
            .where("OrderDate", FilterQueryOp.Equals, testDate);
        //  .where("OrderDate", "==", testDate); // alternative to FilterQueryOp

        stop();
        queryForNone(newEm, query, "date orders query")
        .fail(handleFail)
        .fin(start);
    });
    /*********************************************************
    * orders shipped after they were required.
    * Demonstrates comparison of two fields in the same record
    *********************************************************/
    test("orders shipped after they were required", function () {
        expect(1);
        var query = EntityQuery.from("Orders")
            .where("ShippedDate", ">", "RequiredDate");

        verifyQuery(newEm, query, "shipped > required query");
    });

    /*********************************************************
    * No employee whose FirstName and LastName are the same.
    * Demonstrates comparison of two fields in the same record
    * (compare with next test)
    *********************************************************/
    asyncTest("No employee whose FirstName and LastName are the same", function () {
        expect(1);
        var query = EntityQuery.from("Employees")
            .where("FirstName", "==", "LastName");

        queryForNone(newEm, query, "FirstName === LastName")
        .catch(handleFail).finally(start);
    });

    /*********************************************************
     * Breeze will interpret a string value as a property name
     * if the value happens to correspond to a property name
     * Eliminate all possible ambiguity by building a predicate with an object value
    *********************************************************/
    asyncTest("No employee whose FirstName === 'LastName' (using value object)", function () {
        expect(1);
        var query = EntityQuery.from("Employees")
            // We're looking for a person with the first name of 'LastName'
            // Hey ... it could happen :-)
            .where("FirstName", "==",
                { value: "LastName", isLiteral: true, dataType: breeze.DataType.String });

        queryForNone(newEm, query, "FirstName === 'LastName'")
        .catch(handleFail).finally(start);
    });
    /*********************************************************
    * orders shipped to California (via ComplexType).
    *********************************************************/
    test("orders shipped to California (via ComplexType)", function () {
        expect(2);
        var query = EntityQuery.from("Orders")
            .where("ShipTo.Region", "==", "CA")
            .expand("Customer");

        verifyQuery(newEm, query, "orders query", showOrdersShippedToCA);


        function showOrdersShippedToCA(data) {
            if (data.results.length == 0) return;
            var ords = data.results.map(function (o) {
                return "({0}) '{1}' is in '{2}'".format(
                    o.OrderID(), o.Customer().CompanyName(), o.ShipTo().Region());
            });
            ok(true, "Got " + ords.join(", "));
        }

    });
    /*********************************************************/
    test("orders shipped to California (via ComplexType) WITH PROJECTION", function () {
        expect(2);
        var query = EntityQuery.from("Orders")
            .where("ShipTo.Region", "==", "CA")
            .expand("Customer")
            .select("OrderID, Customer.CompanyName, ShipTo.Region");

        verifyQuery(newEm, query, "orders query", showOrdersShippedToCA);

        function showOrdersShippedToCA(data) {
            if (data.results.length == 0) return;
            var ords = data.results.map(function (o) {
                return "({0}) '{1}' is in '{2}'".format(
                    // Notice that breeze creates projected property names by
                    // flattening the navigation paths using "_" as a separator
                    // (whether path is based on EntityType or ComplexType)
                    o.OrderID, o.Customer_CompanyName, o.ShipTo_Region);
            });
            ok(true, "Got " + ords.join(", "));
        }

    });
    /*********************************************************
    * customers from nowhere (testing for null)
    *********************************************************/
    test("customers from nowhere", function () {
        expect(2);
        var query = EntityQuery
            .from("Customers")
            .where("Region", "==", null)
            .orderBy("CompanyName");

        verifyQuery(newEm, query, "customers with null region'",
            showCustomerResults);
    });

    /*********************************************************
    * customers from somewhere (testing for not null)
    *********************************************************/
    test("customers from somewhere", function () {
        expect(2);
        var query = EntityQuery
            .from("Customers")
            .where("Region", "!=", null)
            .orderBy("CompanyName");

        verifyQuery(newEm, query, "customers with non-null region'",
            showCustomerResults);
    });


    /*********************************************************
    * ok to return no results (not an error)
    *********************************************************/
    test("customers from Mars", function () {
        expect(1);
        var query = EntityQuery
            .from("Customers")
            .where("Region", "==", "Mars");

        stop(); // going async
        queryForNone(newEm, query, "customers from Mars")
        .fail(handleFail)
        .fin(start); // resume testrunner

    });

    /*********************************************************
    * The Alfreds customer by id
    *********************************************************/
    test("Alfreds customer by id", function () {
        expect(2);
        var query = new EntityQuery("Customers")
            .where(alfredsPredicate);

        stop(); // going async ...
        queryForOne(newEm, query, "customer by Id") // querying ...
        .then(function (data) {   // back from query
            ok(true, "Customer name is " + data.first.CompanyName());
        })
        .fail(handleFail)
        .fin(start);
    });

    /*********************************************************
    * The Alfreds customer by key
    * Let metadata say what is the EntityKey
    * Make query from the key-and-value
    *********************************************************/
    test("Alfreds customer by key", function () {
        expect(2);
        var em = newEm();
        var customerType =
            em.metadataStore.getEntityType("Customer");

        var key = new breeze.EntityKey(customerType, alfredsID);

        var query = EntityQuery.fromEntityKey(key);

        stop(); // going async ...
        queryForOne(em, query, "customer by key") // querying ...
        .then(function (data) {   // back from query
            ok(true, "Customer name is " + data.first.CompanyName());
        })
        .fail(handleFail)
        .fin(start);
    });
    /*********************************************************
    * Remote query does NOT return deleted entities (by default) D#2636
    *********************************************************/
    asyncTest("Remote query does NOT return deleted entities (by default)", function() {
        expect(1);
        var em = newEm();
        // fake alfreds customer in cache in a deleted state
        em.createEntity('Customer', {
            CustomerID: alfredsID,
            CompanyName: "Alfreds"
        }, breeze.EntityState.Deleted);

        EntityQuery.from("Customers")
        .where(alfredsPredicate)
        .using(em).execute()
        .then(function (data) { // back from query
            if (data.results.length == 0) {
              ok(true, "Deleted Customer not found (presumably because deleted)");
            } else {
              var cust = data.results[0];
              ok(false, "Returned {0} Customer whose name is {1}.".
                format(cust.entityAspect.entityState.name, cust.CompanyName()));
            }


        })
        .fail(handleFail).fin(start);
    });
    /*********************************************************
    * Remote query CAN return deleted entities with 'includeDeleted' option F#2256
    *********************************************************/
    asyncTest("Remote query CAN return deleted entities with 'includeDeleted' option", function () {
        expect(1);
        var em = newEm();
        // fake alfreds customer in cache in a deleted state
        em.createEntity('Customer', {
            CustomerID: alfredsID,
            CompanyName: "Alfreds",
        }, breeze.EntityState.Deleted);

        // Base on this manager's default QueryOptions
        var queryOption = em.queryOptions.using({ includeDeleted: true });

        /*
        // Base on the QueryOptions class default
        var queryOption = new breeze.QueryOptions({ includeDeleted: true });
        */

        EntityQuery.from("Customers")
        .where(alfredsPredicate)
        .using(queryOption)
        .using(em).execute()
        .then(function (data) { // back from query
            var cust = data.results[0];
            if (cust == null) {
                ok(false, "Deleted Customer not found or not returned");
            } else {
                ok(true, "Returned {0} Customer whose name is {1}.".
                    format(cust.entityAspect.entityState.name, cust.CompanyName()));
            }
        })
        .fail(handleFail).fin(start);
    });
    /*****************************************************************
    * Nancy's orders  (compare nullable int)
    ******************************************************************/
    // Note: Order.EmployeeID is nullable<int>; can still filter on it.
    test("Nancy's orders by Order.EmployeeID", function () {
        expect(1);
        var query = new EntityQuery("Orders")
           .where("EmployeeID", "==", testFns.wellKnownData.nancyID);

        verifyQuery(newEm, query, "Nancy Davolio's orders");
    });

    /*********************************************************
    * Alfreds orders (compare nullable Guid)
    *********************************************************/
    // Note: Order.CustomerID is nullable<Guid>; can still filter on it.
    test("Alfreds orders by Order.CustomerID", function () {
        expect(1);
        var query = new EntityQuery("Orders")
            .where(alfredsPredicate);

        verifyQuery(newEm, query);
    });


    /*** Single conditions with functions ***/

    /*********************************************************
    * customers with a name > 30 chars (compare w/ an OData function)
    *********************************************************/
    test("customers with long names", function () {
        expect(2);
        var query = EntityQuery
            .from("Customers")
            .where("length(CompanyName)", ">", 30);

        verifyQuery(newEm, query, "customer w/ name > 30 chars'",
            showCustomerResults);
    });

    /*********************************************************
    * customers whose 2nd and 3rd letters are "om" (compare w/ an OData function)
    *********************************************************/
    test("customers whose 2nd and 3rd letters are \"om\"", function () {
        expect(2);
        var query = EntityQuery.from("Customers")
        .where("toUpper(substring(CompanyName, 1, 2))", "==", "OM");

        verifyQuery(newEm, query, "customer substring query",
            showCustomerResults);
    });

    /*********************************************************
    * customer whose name contains 'market' (compare w/ nested OData functions)
    *********************************************************/
    test("customers whose name contains 'market'", function () {
        expect(2);
        var query = EntityQuery.from("Customers")
            .where("CompanyName", FilterQueryOp.Contains, 'market');
        //.where("CompanyName", "contains", 'market'); // Alternative to FilterQueryOp
        //.where("substringof(CompanyName,'market')", "eq", true); // becomes in OData
        //.where("indexOf(toLower(CompanyName),'market')", "ne", -1); // equivalent to

        verifyQuery(newEm, query, "customer query",
            showCustomerResults);
    });


    /*********************************************************
    * Query using withParameters
    *********************************************************/
    asyncTest("can query 'withParameters'", function () {
        expect(2);
        var em = newEm();
        var query = EntityQuery.from("CustomersStartingWith")
            .withParameters({ companyName: "qu"});

        em.executeQuery(query).then(success).fail(handleFail).fin(start);

        function success(data) {
            var results = data.results, len = results.length;
            ok(len, "should have customers; got " + len);
            var qu = 0;
            results.forEach(function (c) { qu += /qu.*/i.test(c.CompanyName()); });
            ok(len === qu, "all of them should begin 'Qu'");
        }
    });
    /*********************************************************
    * Combination of IQueryable and withParameters
    *********************************************************/
    asyncTest("can query combining 'withParameters' and filter", function () {
        expect(3);
        var em = newEm();
        var query = EntityQuery.from("CustomersStartingWith")
            .where('Country', 'eq', 'Brazil')
            .withParameters({ companyName: "qu" });

        em.executeQuery(query).then(success).fail(handleFail).fin(start);

        function success(data) {
            var results = data.results, len = results.length;
            ok(len, "should have customers; got " + len);
            var qu = 0;
            results.forEach(function (c) { qu += /qu.*/i.test(c.CompanyName()); });
            ok(len === qu, "all of them should begin 'Qu'");
            var brazil = 0;
            results.forEach(function (c) { brazil += c.Country() === "Brazil"; });
            ok(len === brazil, "all of them should be in Brazil");
        }
    });
    /*********************************************************
     * Dealing with response order of parallel queries
     * The order in which the server responds is not predictable
     * but promise library ensures order of the results
     *
     * It's difficult to make the server flip the response order
     * (run it enough times and the response order will flip)
     * but the logic of this test manifestly deals with it
     * because of the way it assigns results.
     *********************************************************/
    asyncTest("can run queries in parallel with Q.all and preserve response order", function () {
        var arrived = [];

        var queries = [
            EntityQuery.from('Customers').where('CompanyName', 'startsWith', 'a'),
            EntityQuery.from('Customers').where('CompanyName', 'startsWith', 'c'),
            EntityQuery.from('Customers').where('CompanyName', 'startsWith', 's'),
            EntityQuery.from('Customers').where('CompanyName', 'startsWith', 't')
        ];

        expect(queries.length);

        var em = newEm();
        var promises = queries.map(function(q, i){
            return em.executeQuery(q).finally(function(){arrived.push(i);});
        });

        breeze.Q.all(promises)
            // called when ALL promises have been fulfilled
            .then(function(responses){
                // Completion order is unpredictable. Uncomment and re-run several times to see for yourself
                console.log("Order of parallel query responses was " + JSON.stringify(arrived));

                // regardless, the promise responses are in the same order as the queries
                responses.forEach(function(res, rix) {
                    var qix = queries.indexOf(res.query);
                    equal(qix, rix, 'response ' + rix + ' was for query ' +
                        qix + ' ' + res.query.wherePredicate.toString());
                });
            })
            .catch(handleFail)
            .finally(start);
    });

    /*** PREDICATES ***/

    module("queryTests (predicates)", testFns.getModuleOptions(newEm));

    /*********************************************************
    * customers in London
    *********************************************************/
    test("customers in London", function () {
        expect(2);
        var pred = new Predicate("City", FilterQueryOp.Equals, "London");

        var query = new EntityQuery("Customers").where(pred);

        verifyQuery(newEm, query, "customers in London",
            showCustomerResults);
    });

    /*********************************************************
    * customers in London or Paris
    *********************************************************/
    test("customers in London OR Paris", function () {
        expect(2);
        var pred = new Predicate("City", FilterQueryOp.Equals, "London")
                             .or("City", "==", "Paris");

        var query = new EntityQuery("Customers").where(pred);

        verifyQuery(newEm, query, "customers in London or Paris",
            showCustomerResults);
    });

    /*********************************************************
    * orders ordered after April'98 AND with freight > 100
    *********************************************************/
    test("orders ordered after April '98 AND with freight > 100", function () {
        expect(2);
        var pred;
        // Make sure date is in UTC (like the datetimes in the database)
        var testDate = new Date(Date.UTC(1998, 3, 1)); // month counts from zero!

        var baseQuery = EntityQuery.from("Orders");
        var p1 = new Predicate("Freight", ">", 100);
        var p2 = new Predicate("OrderDate", ">", testDate);


        // All of these predicates are the same:
        pred = p1.and(p2);

        // pred = Predicate.and([p1, p2]);

        // pred = Predicate
        //           .create("Freight", ">", 100)
        //           .and("OrderDate", ">", testDate);


        var query = baseQuery.where(pred);
        var em = newEm();
        var orderEntityType = em.metadataStore.getEntityType("Order");
        ok(true, "OData predicate: " + pred.toODataFragment(orderEntityType));

        stop();

        // all should return exactly 15 orders
        runQuery(em, query, "AND orders query", 15)
        .fail(handleFail)
        .fin(start);
    });

    /*********************************************************
    * orders either ordered after April'98 OR with freight > 100
    *********************************************************/
    test("orders ordered after April '98 OR with freight > 100", function () {
        expect(2);
        var pred;
        // Make sure date is in UTC (like the datetimes in the database)
        var testDate = new Date(Date.UTC(1998, 3, 1)); // month counts from zero!

        var baseQuery = EntityQuery.from("Orders");
        var p1 = new Predicate("Freight", ">", 100);
        var p2 = new Predicate("OrderDate", ">", testDate);


        // All of these predicates are the same:
        // pred = p1.or(p2);

        pred = Predicate.or([p1, p2]);

        // pred = Predicate
        //           .create("Freight", ">", 100)
        //           .or("OrderDate", ">", testDate);


        var query = baseQuery.where(pred);
        var em = newEm();
        var nullEntityType = new EntityType(em.metadataStore);
        ok(true, "OData predicate: " + pred.toODataFragment(nullEntityType));

        stop();

        // all should return exactly 256 orders
        runQuery(em, query, "OR orders query", 256)
        .fail(handleFail)
        .fin(start);
    });

    /*********************************************************
    * orders that do NOT have freight > 100
    *********************************************************/
    test("orders that do NOT have freight > 100", function () {
        expect(2);
        var pred;
        var baseQuery = EntityQuery.from("Orders");
        var basePred = new Predicate("Freight", ">", 100);

        // These predicates are the same:
        pred = basePred.not();
        // pred = Predicate.not(basePred);

        var query = baseQuery.where(pred);
        var em = newEm();
        var nullEntityType = new EntityType(em.metadataStore);
        ok(true, "OData predicate: " + pred.toODataFragment(nullEntityType));

        stop();

        // all should return exactly 256 orders
        runQuery(em, query, "NOT orders query", 643)
        .fail(handleFail)
        .fin(start);
    });

    /*********************************************************
    * orders shipped in '96 with freight > 100
    * define predicates separately and combine in new predicate
    *********************************************************/
    test("orders shipped in '96 with freight > 100", function () {
        expect(2);
        // Get the predicate and show what it looks like in OData
        var pred = getOrderedIn1996Predicate();
        var em = newEm();

        // DISPLAY generated OData query clause
        // Need a type. Any type will work, even a dummy type
        //   var dummyType = new EntityType(em.metadataStore);
        // But we'll use the Order type in this example which is more accurate
        var orderType = em.metadataStore.getEntityType('Order');
        ok(true, "OData predicate: " + pred.toODataFragment(orderType));

        var query = new EntityQuery("Orders").where(pred);

        verifyQuery(newEm, query, "orders query");
    });


    function getOrderedIn1996Predicate() {

        var pred = breeze.Predicate
            .create('OrderDate', '>=', new Date(Date.UTC(1996, 0, 1))) // Jan===0 in JavaScript
            .or(    'OrderDate', '<',  new Date(Date.UTC(1997, 0, 1)))
            .and(   'Freight',   '>',  100);
        return pred;

        /*
          See also http://stackoverflow.com/questions/24053168/how-do-i-write-a-breeze-predicate-equivalent-to-the-following-sql/24068591#24068591

          Noteworthy:

          1) The **left-to-right composition of the predicates**.

             a) The `create` call predicate creates the date-gte predicate

             b) The `or` call returns a predicate which is the OR of the 1st predicate and 
                the 2nd date condition. This is the OR predicate

             c) The third `and` call returns the AND of the OR-predicate and the Freight condition.

          2) This predicate isn't associated with Order.
             Could apply to any query for a type with 'OrderDate' and 'Freight' properties.

          3) Using `new Date(Date.UTC(...))` to specify dates that are
             a) unambiguous in the face of international differences for date literals
             b) have no time values (and we hope the db doesn't have them either)
             c) are created as UTC dates to avoid timezone issues

          4) This is the verbose alternative:

            var p1 = breeze.Predicate
                     .create("OrderDate", ">=", new Date(Date.UTC(1996, 0, 1))) // Jan===0 in JavaScript
                     .and("OrderDate", "<", new Date(Date.UTC(1997, 0, 1)));

            var p2 = new breeze.Predicate("Freight", ">", 100);

            return p1.and(p2);

          5) Someday, when we have date function support, we could write this version of p1

             var p1 = new breeze.Predicate("year(OrderDate)", FilterQueryOp.Equals, 1996); 

        */
    }

    /***  RELATED PROPERTY / NESTED QUERY ***/

    module("queryTests (related property conditions)", testFns.getModuleOptions(newEm));

    /*********************************************************
    * Orders of Customers located in California
    * Customer is the related parent of Order
    * Demonstrates "nested query", filtering on a related entity
    *********************************************************/
    test("orders of Customers located in California", function () {
        expect(2);
        var query = EntityQuery.from("Orders")
            .where("Customer.Region", "==", "CA")
            .expand("Customer");

        verifyQuery(newEm, query, "orders query", showOrdersToCA);
    });


    function showOrdersToCA(data) {
        if (data.results.length == 0) return;
        var ords = data.results.map(function (o) {
            return "({0}) '{1}' is in '{2}'".format(
                o.OrderID(), o.Customer().CompanyName(), o.Customer().Region());
        });
        ok(true, "Got " + ords.join(", "));
    }

    /*********************************************************
    * Orders of Customers whose name starts with 'Alfred'
    * Customer is the related parent of Order
    * Demonstrates "nested query", filtering on a related entity
    *********************************************************/
    test("orders of Customers whose name starts with 'Alfred'", function () {
        expect(2);
        var query = EntityQuery.from("Orders")
            .where("Customer.CompanyName", "startsWith", "Alfred")
            .expand("Customer");

        verifyQuery(newEm, query, "orders query", showOrdersToAlfred);

        function showOrdersToAlfred(data) {
            if (data.results.length == 0) return;
            var ords = data.results.map(function (o) {
                return "({0}) to '{1}'".format(
                    o.OrderID(), o.Customer().CompanyName());
            });
            ok(true, "Got " + ords.join(", "));
        }
    });

    /*********************************************************
    * Products in a Category whose name begins with 'S'
    * Category is the related parent of Product
    *********************************************************/
    test("Products in categories whose names start with 'S'", function () {
        expect(2);
        var query = EntityQuery.from("Products")
            .where("Category.CategoryName", "startsWith", "S")
            .expand("Category");

        verifyQuery(newEm, query, "products query", showProductsInCategoryS);
    });

    function showProductsInCategoryS(data) {
        if (data.results.length == 0) return;
        var prods = data.results.map(function (p) {
            return "({0}) '{1}' is a '{2}'".format(
                p.ProductID(), p.ProductName(), p.Category().CategoryName());
        });
        ok(true, "Got " + prods.join(", "));
    }

    /*********************************************************
     * Orders with an OrderDetail for a specific product
     * Demonstrates "nested query" filtering on a collection navigation
     * You can't really do this clientside.
     * But you can call a controller method to do it
     *********************************************************/
    test("orders for Chai", function () {
        expect(2);
        var manager = newEm();
        var chaiProductID = testFns.wellKnownData.chaiProductID;

        var query = EntityQuery.from("OrdersForProduct/?productID=" + chaiProductID);
        // query = query.expand("Customer, OrderDetails");

        stop();
        manager.executeQuery(query)
            .then(showChaiOrders)
            .fail(handleFail)
            .fin(start);

        function showChaiOrders(data) {
            ok(data.results.length, "should have orders");
            var prods = data.results.map(function (o) {
                var customer = o.Customer();

                var customerName = customer ? customer.CompanyName() : "<unknown customer>";

                var chaiItems = o.OrderDetails().filter(
                    function (od) { return od.ProductID() === chaiProductID; });

                var quantity = (chaiItems.length) ? chaiItems[0].Quantity() : "some";

                return "({0}) '{1}' ordered {2} boxes of Chai".format(
                    o.OrderID(), customerName, quantity);
            });
            ok(true, "Got " + prods.join(", "));
        }
    });

    /*** EXPAND ***/

    module("queryTests (expand)", testFns.getModuleOptions(newEm));


    /*********************************************************
    * Alfreds orders, expanded with their OrderDetails
    *********************************************************/
    test("Alfreds orders expanded with their OrderDetails", function () {
        expect(3);
        var query = new EntityQuery("Orders")
          .where(alfredsPredicate)
          .expand("OrderDetails");

        var em = newEm();

        verifyQuery(em, query, "Alfred's orders expanded",
                    assertGotOrderDetails);

    });

    /*********************************************************
    * Alfreds orders, expanded with their parent Customers and
    * child OrderDetails
    *********************************************************/
    test("Alfreds orders expanded with parent Customer and their child details ", function () {
        expect(4);
        var query = new EntityQuery("Orders")
              .where(alfredsPredicate)
              .expand("Customer, OrderDetails");

            var em = newEm();

            verifyQuery(em, query, "Alfred's orders expanded",
                        assertGotOrderDetails, assertGotCustomerByExpand);

        });

    /*********************************************************
    * Alfreds orders, including their OrderDetails,
    * and the Products of those details,
    * using property path: "OrderDetails.Product"
    *********************************************************/
    test("Alfreds orders expanded with their OrderDetails and Products", function () {
        expect(4);
        var query = new EntityQuery("Orders")
                  .where(alfredsPredicate)
                  .expand("OrderDetails.Product");

                var em = newEm();

                verifyQuery(em, query, "Alfred's orders expanded",
                    assertGotOrderDetails, assertGotProductByExpand);

            });


    function assertGotOrderDetails(data) {

        var em = data.query.entityManager;
        var odType = em.metadataStore.getEntityType("OrderDetail");

        var odsInCache = em.getEntities(odType); // all OrderDetails in cache
        var odsInCacheCount = odsInCache.length;

        ok(odsInCacheCount > 0, "should have OrderDetails in cache; got " + odsInCacheCount);

        var firstOrder = data.results[0];
        var odsByNav = firstOrder.OrderDetails(); // remember to use () ... it's a KO property

        ok(odsByNav.length > 0, "can navigate to first order's OrderDetails");

        // To manually confirm these results, run this SQL:
        // select count(*) from OrderDetail where OrderID in
        //   (select OrderID from [Order] where CustomerID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2')
    }

    function assertGotCustomerByExpand(data) {
        var firstOrder = data.results[0];
        var cust = firstOrder.Customer();

        ok(cust !== null, "can navigate to first order's Customer");
    }

    function assertGotProductByExpand(data) {
        var firstOrder = data.results[0];
        var firstProduct = firstOrder.OrderDetails()[0].Product();

        ok(firstProduct !== null, "can navigate to first order's first detail's product");
    }

    asyncTest("can query for products and get related Supplier entity with complex type", function () {
        expect(2);
        var em = newEm();

        EntityQuery.from('Products').top(1)
            .expand('Supplier')
            .using(em).execute()
            .then(success).fail(handleFail).fin(start);

        function success(data) {
            var product = data.results[0];
            ok(product != null, "should have a product");
            ok(product && product.Supplier() !== null, "product should have a supplier");
        }
    });

    /*******  SOME WACKY TESTS UNRELATED TO EXPAND **********/
    
    /*********************************************************
    * When API method returns an HttpResponseMessage (HRM)
    * can filter, select, and expand
    *********************************************************/
    asyncTest("Can filter and select using API method " +
              "that returns an HttpResponseMessage", function () {
        expect(2);
        var em = newEm();
            var query = new EntityQuery.from('CustomersAsHRM')
                .where("CustomerID", "eq", alfredsID)
                .select('CustomerID, CompanyName');

            em.executeQuery(query)
              .then(success).fail(handleFail).fin(start);

            function success(data) {
                var results = data.results;
                equal(results.length, 1, "should have returned one customer");
                var first = results[0];
                ok(!first.entityAspect, 'should be a projection, not an entity');
            }
        });

    /*********************************************************
    * When run separate queries for Employee, Orders, EmployeeTerritories.
    * Breeze will wire up their relationships.
    *
    * These next tests are a response to the SO question
    * http://stackoverflow.com/questions/24001496/breeze-js-priming-loading-and-caching-data-via-asynchronous-requests
    *
    * The tests verify the entity wiring after all queries have finished.
    *
    * Note that Employee has many Orders and many EmployeeTerritories
    * which matches the SO question's model structure
    *********************************************************/
    asyncTest("Can run parallel queries and breeze will wire relationships", function () {
        expect(5);
        var em = newEm();
        var queries = make_Emp_Orders_EmpTerritories_Queries(em);
        var all = [
            queries.eQuery.execute(),
            queries.etQuery.execute(),
            queries.oQuery.execute()
        ];
        Q.all(all)
        .then(function () { check_Emp_Orders_EmpTerritories(queries); })
        .catch(handleFail).finally(start);
    });

    asyncTest("Can chain queries, dependent first, and breeze will wire relationships", function () {
        expect(5);
        var em = newEm();
        var queries = make_Emp_Orders_EmpTerritories_Queries(em);
        // Run dependent entity queries first starting with Orders
        queries.oQuery.execute()
        // then EmployeeTerritories
        .then(function () { return queries.etQuery.execute(); })
        // lastly the principal (Employee) query
        .then(function () { return queries.eQuery.execute(); })
        // now assert that everything is wired up
        .then(function () { check_Emp_Orders_EmpTerritories(queries); })
        .catch(handleFail).finally(start);
    });

    function make_Emp_Orders_EmpTerritories_Queries(em) {
        var eQuery = EntityQuery.from("Employees").using(em)
                .where('EmployeeID', '==', 1); // trim to just Nancy
        var etQuery = EntityQuery.from("EmployeeTerritories").using(em);
        var oQuery = EntityQuery.from("Orders").using(em)
                 .where('EmployeeID', '==', 1); // trim to just Nancy's orders 
        return {
            eQuery: eQuery,
            etQuery: etQuery,
            oQuery: oQuery
        };
    }

    function check_Emp_Orders_EmpTerritories(queries) {
        var emps           = queries.eQuery.executeLocally();
        var empTerritories = queries.etQuery.executeLocally();
        var orders         = queries.oQuery.executeLocally();

        equal(emps.length, 1, "should have one Employee (Nancy)");
        notEqual(orders.length, 0, "should have Orders");
        notEqual(empTerritories.length, 0, "should have EmployeeTerritories");

        var e1 = emps[0];
        var e1Name = e1.FirstName();
        var e1OrdersLen = e1.Orders().length;
        var e1EmpTerritoriesLen = e1.EmployeeTerritories().length;

        notEqual(e1OrdersLen, 0,
            "'{0}' has {1} Orders".format(e1Name, e1OrdersLen));
        notEqual(e1EmpTerritoriesLen, 0,
            "'{0}' has {1} EmployeeTerritories".format(e1Name, e1EmpTerritoriesLen));
    };

    /*** ORDERING AND PAGING ***/

    module("queryTests (ordering & paging)", testFns.getModuleOptions(newEm));

    /*********************************************************
    * products sorted by ProductName ascending
    *********************************************************/
    test("products sorted by name ascending ", function () {
        expect(2);
        var query = EntityQuery.from("Products")
            .expand("Category")
            .orderBy("ProductName");

        verifyQuery(newEm, query, "products query",
            showProductResults);
    });

    /*********************************************************
    * products sorted by ProductName descending
    *********************************************************/
    test("products sorted by name descending ", function () {
        expect(2);
        var query = EntityQuery.from("Products")
            .expand("Category")
        //            .orderBy("ProductName desc"); // either this way ...
            .orderByDesc("ProductName"); // ... or this way

        verifyQuery(newEm, query, "products query",
            showProductResults);
    });

    /*********************************************************
    * products sorted by price descending, then name ascending
    *********************************************************/
    test("products sorted by price descending, then name ascending ", function () {
        expect(2);
        var query = EntityQuery.from("Products")
            .expand("Category")
            .orderBy("UnitPrice desc, ProductName");

        verifyQuery(newEm, query, "products query",
            showProductResults);
        // look in results for ...
        //    (27) 'Schoggi Schokolade' at $43.9 in 'Confections',
        //    (63) 'Vegie-spread' at $43.9 in 'Condiments',...
    });

    /*********************************************************
    * products sorted by related property (Category.CategoryName)
    *********************************************************/
    test("products sorted by related Category descending ", function () {
        expect(2);
        var query = EntityQuery.from("Products")
            .expand("Category")
            .orderBy("Category.CategoryName desc, ProductName");
        //.orderByDesc("Category.CategoryName"); // works but can only have one sort prop

        verifyQuery(newEm, query, "products query",
            showProductResults);
    });

    /*********************************************************
    * products take
    *********************************************************/
    test("first 5 products w/ take(5) ", function () {
        expect(2);
        var query = EntityQuery.from("Products")
            .orderBy("ProductName")
            .take(5)
            .expand("Category");

        verifyQuery(newEm, query, "products query",
            showProductResults);
    });

    /*********************************************************
    * products skip
    *********************************************************/
    test("skip 10 products ", function () {
        expect(2);
        var query = EntityQuery.from("Products")
            .orderBy("ProductName")
            .skip(10)
            .expand("Category");

        verifyQuery(newEm, query, "products query",
            showProductResults);
    });

    /*********************************************************
    * products paging with skip and take
    *********************************************************/
    test("paging products with skip 10, take 5", function () {
        expect(2);
        var query = EntityQuery.from("Products")
            .orderBy("ProductName")
            .skip(10)
            .take(5)
            .expand("Category");

        verifyQuery(newEm, query, "products query",
            showProductResults);
    });
    function showProductResults(data) {
        var limit = 15;
        var count = data.results.length;
        var results = limit < count ? data.results.slice(0, limit) : data.results;
        var out = results.map(function (p) {
            return "({0}) '{1}' at ${2} in '{3}'".format(
                p.ProductID(), p.ProductName(), p.UnitPrice(),
                p.Category().CategoryName());
        });
        if (count > out.length) { out.push("..."); }
        ok(true, "Got {0} products: {1}".format(count, out.join(", ")));
    }
    /*********************************************************
    * inlineCount of paged products
    *********************************************************/
    test("inlineCount of paged products", function () {
        expect(2);
        // Filtered query
        var productQuery = EntityQuery.from("Products")
            .where("ProductName", "startsWith", "C");

        // Paging of that filtered query ... with inlineCount
        var pagedQuery = productQuery
            .orderBy("ProductName")
            .skip(5)
            .take(5)
            .inlineCount();

        var productCount, pagedCount, inlineCount;
        var em = newEm();
        stop(); // going async

        // run both queries in parallel
        var promiseProduct =
            em.executeQuery(productQuery)
                .then(function(data) {
                     productCount = data.results.length;
                });

        var promisePaged =
            em.executeQuery(pagedQuery)
                .then(function (data) {
                    pagedCount = data.results.length;
                    inlineCount = data.inlineCount;
                });

        Q.all([promiseProduct, promisePaged])
            .then(function() {
                ok(inlineCount,
                    "'data' from paged query should have 'inlineCount'");
                equal(inlineCount, productCount,
                    "'inlineCount' should equal product count");
            })
            .fail(handleFail)
            .fin(start);
    });


    /*** PROJECTION ***/

    module("queryTests (projections)", testFns.getModuleOptions(newEm));

    /*********************************************************
    * PROJECTION: customer names of Customers starting w/ 'C'
    * A projection of just the one property
    *********************************************************/
    test("select company names of Customers starting w/ 'C'", function () {
        expect(2);
        var query = EntityQuery.from("Customers")
            .where("CompanyName", FilterQueryOp.StartsWith, "C")
            .select("CompanyName")
            .orderBy("CompanyName");

        verifyQuery(newEm, query,
            "company names of Customers starting w/ 'C'",
            showCompanyNames);
    });

    function showCompanyNames(data) {
        var names = data.results.map(function (item) {
            // N.B.: the property is just a value and is NOT a KO property
            return item.CompanyName;
        });

        ok(true, "Names are " + names.join(", "));
    }

    /*********************************************************
    * PROJECTION: customer names of Orders with Freight >500
    *********************************************************/
    test("select company names of orders with Freight > 500", function () {
        expect(2);
        var query = EntityQuery.from("Orders")
            .where("Freight", FilterQueryOp.GreaterThan, 500)
            .select("Customer.CompanyName")
            .orderBy("Customer.CompanyName")
            .expand("Customer");

        verifyQuery(newEm, query,
            "orders w/ big freight costs",
            showCustomer_CompanyNames); // Notice that the ".' in the path becomes "_"
    });

    function showCustomer_CompanyNames(data) {
        var names = data.results.map(function (item) {
            // Notice that the ".' in the path becomes "_"
            // N.B.: the property is just a value and is NOT a KO property
            return item.Customer_CompanyName;
        });

        ok(true, "Customer_CompanyName(s) are " + names.join(", "));
    }
    /*********************************************************
    * PROJECTION: selected properties of Customers starting w/ 'C'
    * A projection of multiple data property
    *********************************************************/
    test("project several properties of Customers starting w/ 'C'", function () {
        expect(2);
        var query = EntityQuery.from("Customers")
            .where("CompanyName", FilterQueryOp.StartsWith, "C")
        //.select("CustomerID", "CompanyName", "ContactName" ) // future alternate syntax?
            .select("CustomerID, CompanyName, ContactName")
            .orderBy("CompanyName");

        verifyQuery(newEm, query,
            "projection of Customers starting w/ 'C'",
            showProjectedCustomer);
    });

    function showProjectedCustomer(data) {

        var projection = data.results.map(function (item) {
            return "[({0}) '{1}' - '{2}']".format(
            // N.B.: the property are just plain values and are NOT KO properties
                item.CustomerID, item.CompanyName, item.ContactName);
        });

        ok(true, "Projected customers are " + projection.join(", "));
    }

    /*********************************************************
    * PROJECTION: orders of Customers starting w/ 'C'
    * A projection of just the one navigation property
    *********************************************************/
    test("select orders of Customers starting w/ 'C'", function () {
        expect(3);
        var query = EntityQuery.from("Customers")
            .where("CompanyName", FilterQueryOp.StartsWith, "C")
            .select("Orders");

        verifyQuery(newEm, query,
            "orders of Customers starting w/ 'C'",
            assertCustomersNotInCache,
            assertOrdersInCache);
    });

    /*********************************************************
    * PROJECTION: names Customers starting w/ 'C' AND their orders
    * Note that orders are in cache because they are whole entities
    * Customer names are not entities and are not in cache.
    *********************************************************/
    test("names of Customers starting w/ 'C' and their orders", function () {
        expect(4);
        var query = EntityQuery.from("Customers")
            .where("CompanyName", FilterQueryOp.StartsWith, "C")
            .select("CompanyName, Orders")
            .orderBy("CompanyName");

        verifyQuery(newEm, query,
            "{Customer, Customer.Orders} projection",
            showCompanyNamesAndOrderCounts,
            assertCustomersNotInCache,
            assertOrdersInCache);
    });

  /*
   * Use a server-side endpoint (CustomersAnd1998Orders) that returns Customers and
   * just those of their Orders placed in 1998 using a SERVER-SIDE PROJECTION.
   * This endpoint projects into a 'CustomerDto' type which is
   * structurally the same as a Customer. We cast it here with 'toType'
   */
    test("names of Customers starting w/ 'C' and their 1998 Orders", function () {
      expect(5);
      var query = EntityQuery.from('CustomersAnd1998Orders')
          .where('CompanyName', 'startsWith', 'C')
          .orderBy("CompanyName")
          .toType('Customer'); // Essential ... unless fix JsonResultsAdapter

      verifyQuery(newEm, query,
          "Customers from 'CustomersAnd1998Orders' projection",
          showCompanyNamesAndOrderCounts,
          assertCustomersInCache,
          assertOrdersInCache,
          assertAllOrdersIn1998);

      function assertAllOrdersIn1998(data) {
        var em = data.query.entityManager;
        var ordersInCache = em.getEntities('Order');
        var all1998 = ordersInCache.every(function(o) {
          var ordered = o.getProperty('OrderDate');
          return ordered && ordered.getFullYear() === 1998;
        });
        ok(all1998, 'all cached orders should have been ordered in 1998');
      }
    });

    function showCompanyNamesAndOrderCounts(data) {
        var names = data.results.map(function (item) {
            return "{0} ({1})".format(item.CompanyName, item.Orders.length);
        });

        ok(true, names.join(", "));
    }

    function assertCustomersInCache(data) {
      var em = data.query.entityManager;
      var custCount = em.getEntities('Customer').length;
      ok(custCount > 0,
            "should have customers in cache; count = " + custCount);
    }

    function assertCustomersNotInCache(data) {
      var em = data.query.entityManager;
      var custCount = em.getEntities('Customer').length;
      ok(custCount === 0,
            "shouldn't have customers in cache; count = " + custCount);
    }

    function assertOrdersInCache(data) {
        var em = data.query.entityManager;
        var ordersInCache = em.getEntities('Order').length;

        ok(ordersInCache,
            "should have orders in cache; count = " + ordersInCache);
    }

    /*********************************************************
    * PROJECTION: Lookups - a query returing an array of entity lists
    *********************************************************/
    test("query a lookup array of entity lists", function () {
        expect(5);
        var em = newEm();
        stop(); // going async ..
        EntityQuery.from('LookupsArray')
            .using(em).execute()
            .then(querySucceeded)
            .fail(handleFail)
            .fin(start);

        function querySucceeded(data) {
            var lookups = data.results;
            ok(lookups.length === 3, "should have 3 lookup items");
            // each one looks like an array but is actually
            // an object whose properties are '0', '1', '2', etc.
            // would use for..in to iterate over it.
            var regions = lookups[0];
            ok(regions[0], "should have a region");
            var territories = lookups[1];
            ok(territories[0], "should have a territory");
            var categories = lookups[0];
            ok(categories[0], "should have a category");
            equal(categories[0].entityAspect.entityState.name, UNCHANGED.name,
                "first category should be unchanged entity in cache");
        }
    });

    /*********************************************************
    * PROJECTION: Lookups - a query returing an anonymous object
    * whose properties are entity lists
    *********************************************************/
    test("query a lookup object w/ entity list properties", function () {
        expect(5);
        var em = newEm();
        stop(); // going async ..
        EntityQuery.from('Lookups')
            .using(em).execute()
            .then(querySucceeded)
            .fail(handleFail)
            .fin(start);

        function querySucceeded(data) {
            ok(data.results.length, "should have query results");
            var lookups = data.results[0];
            ok(lookups.regions.length, "should have lookups.regions");
            ok(lookups.territories.length, "should have lookups.territories");
            ok(lookups.categories.length, "should have lookups.categories");
            equal(lookups.categories[0].entityAspect.entityState.name,
                UNCHANGED.name,
                "first lookups.category should be unchanged entity in cache");
        }
    });

    /*********************************************************
    * PROJECTION: Populate a combobox with a list from a lookup
    * Also demonstrates QUnit testing of Knockout binding
    *********************************************************/
    test("Can populate a combobox with a list from a lookup", function () {
        expect(1);
        var view = setupCombobox();
        var vm = getComboboxTestVm();
        ko.applyBindings(vm, view);

        var em = newEm();
        stop(); // going async ..
        EntityQuery.from('Lookups')
            .using(em).execute()
            .then(querySucceeded)
            .fail(handleFail)
            .fin(start);

        function querySucceeded(data) {
            var lookups = data.results[0];
            var categories = lookups.categories;
            vm.categories(categories);
            vm.item().Category(categories[1]);
            var expectedText = categories[1].CategoryName();
            var selectedText = $("select option:selected", view)[0].text;
            equal(selectedText, expectedText,
                "Should have bound to combobox and selected option should be " + expectedText);
        }

        function setupCombobox() {
            var fixtureNode = $('#qunit-fixture').append(
                '<div id="vm" data-bind="with: item"> '+
                    '<label>Categories</label>' +
                    '<select id="categoryCombo" ' +
                        'data-bind="options: $parent.categories, ' +
                        'optionsText: \'CategoryName\', value: Category">' +
                    '</select></div>').get(0);
            return $("#vm", fixtureNode).get(0);
        }

        function getComboboxTestVm() {
            var testItem = {
                Name: ko.observable("Test Item"),
                Category: ko.observable()
            };
            return {
                categories: ko.observableArray(),
                item: ko.observable(testItem)
            };
        }

    });

    /*********************************************************
    * PROJECTION:
    * The next set of tests demo serverside projection for "security".
    * The Users query on the server actually projects into the
    * 'UserPartial' class which only has "safe" properties of the User type.
    * Properties like "Password" are excluded.
    * 'UserPartial' is NOT in server metadata
    *
    * See also metadataTests for example of adding 'UserPartial'
    * to client metadataStore ... and then querying them into cache
    *********************************************************/

    /*********************************************************/
    test("'Users' query returns objects of type 'UserPartial'", function () {
        expect(3);
        var query = EntityQuery.from("UserPartials").top(1);
        var em = newEm();

        verifyQuery(em, query,"userPartials",
            assertUserPartialIsNotAnEntity);

    });
    function assertUserPartialIsNotAnEntity(data) {
        var user = data.results[0];
        ok(user.entityType === undefined,
            "'user' result should not have an entityType");
        ok(user.Password === undefined,
            "'user' result should not have a 'Password' property");
    }
    /*********************************************************/
    test("'GetUserById' query returns 'UserPartial' with roles", function () {
        expect(4);
        var query = EntityQuery
            .from("GetUserById")
            .withParameters({ Id: 3 }); // id=3 has two UserRoles

        var em = newEm();

        verifyQuery(em, query, "GetUserById",
            assertUserPartialIsNotAnEntity,
            assertResultHasRoleNames);

        function assertResultHasRoleNames(data) {
            var user = data.results[0];
            ok(user.RoleNames.length > 0,
                "'user' result has role names: "+user.RoleNames);
        }
    });


    /*** LOCAL QUERY EXECUTION ***/

    module("queryTests (local)", testFns.getModuleOptions(newEm));

    /*********************************************************
    * customers starting w/ 'A' (query the cache)
    * Demonstrates that the same query works
    * for both server and cache.
    *********************************************************/
    test("customers starting w/ 'A' (cache)", function () {
        expect(4);
        // query for customer starting with 'A', sorted by name
        // will be used BOTH on server AND on client.
        // The "expand will be ignored locally but will run remotely
        var query = getQueryForCustomerA().expand("Orders");

        // query cache (synchronous)
        var em = newEm();
        var custs = em.executeQueryLocally(query);
        var count = custs.length;
        ok(count === 0,
            "no cached customers at all in a new EntityManager");

        stop(); // going async ... query server (same query object)
        queryForSome(em, query, "Get 'A' custs from the server")

        .then(function (data) { // ... back from the server
            // query cache again (synchronous)
            custs = em.executeQueryLocally(query);
            count = custs.length;
            ok(count > 0,
                "have cached 'A' customers now; count = " + count);
            showCustomerResults({ results: custs });
        })

        .fail(handleFail)
        .fin(start);
    });

    /*********************************************************
    * Local query does NOT return deleted entities (by default)
    *********************************************************/
    asyncTest("Local query does NOT return deleted entities (by default)", function () {
        expect(1);
        var em = newEm();
        // fake alfreds customer in cache in a deleted state
        em.createEntity('Customer', {
            CustomerID: alfredsID,
            CompanyName: "Alfreds"
        }, breeze.EntityState.Deleted);

        EntityQuery.from("Customers")
        .where(alfredsPredicate)
        .using(breeze.FetchStrategy.FromLocalCache)
        .using(em).execute()
        .then(function (data) {
            var cust = data.results[0];
            if (cust == null) {
                ok(true, "Deleted customer not found (presumably because deleted)");
            } else {
                ok(false, "Returned {0} Customer whose name is {1}.".
                    format(cust.entityAspect.entityState.name, cust.CompanyName()));
            }
        })
        .fail(handleFail).fin(start);
    });

    /*********************************************************
    * Local query CAN return deleted entities with includeDeleted option
    *********************************************************/
    asyncTest("Local query CAN return deleted entities with includeDeleted option", function () {
        expect(1);
        var em = newEm();
        // fake alfreds customer in cache in a deleted state
        em.createEntity('Customer', {
            CustomerID: alfredsID,
            CompanyName: "Alfreds"
        }, breeze.EntityState.Deleted);

        var queryOptions = new breeze.QueryOptions({
            includeDeleted: true, // false by default
            fetchStrategy: breeze.FetchStrategy.FromLocalCache
        });

        EntityQuery.from("Customers")
        .where(alfredsPredicate)
        .using(queryOptions)
        .using(em).execute()
        .then(function (data) {
            var cust = data.results[0];
            if (cust == null) {
                ok(false, "Deleted Customer not found or not returned");
            } else {
                ok(true, "Returned {0} Customer whose name is {1}.".
                    format(cust.entityAspect.entityState.name, cust.CompanyName()));
            }
        })
        .fail(handleFail).fin(start);
    });
    /*********************************************************
    * Combine remote and local query to get all customers
    * including new, unsaved customers
    * v1 - Using FetchStrategy
    *********************************************************/
    test("combined remote & local query gets all customers w/ 'A'", function () {
        expect(6);
        var query = getQueryForCustomerA();

        // new 'A' customer in cache ... not saved
        var em = newEm();
        var newCustomer = addCustomer(em, "Acme");

        // query cache (synchronous)
        var custs = em.executeQueryLocally(query), count = custs.length;
        equal(count, 1, "1st local query returns one cached 'A' customer");

        stop(); // going async ... query server (same query object)

        queryForSome(em, query, "remote query for 'A' custs")

        .then(function (data) { // ... back from the server
            ok(data.results.indexOf(newCustomer) === -1,
                "remote query results do not include the unsaved newCustomer, " +
                newCustomer.CompanyName());

            // re-do both queries as a comboQuery
            return executeComboQueryWithFetchStrategy(em, query);

        })

        .then(function (data) { // back from server with combined results

            var customers = data.results;
            count = customers.length;
            ok(count > 2,
                "have combined remote/local 'A' customers now; count = " + count);
            showCustomerResults(data);
            ok(customers.indexOf(newCustomer) >= 0,
                 "combo query results should include the unsaved newCustomer, " +
                newCustomer.CompanyName());
        })

        .fail(handleFail)
        .fin(start);
    });
    /*********************************************************
    * Combine remote and local query to get all customers
    * including new, unsaved customers
    * v1=using FetchStrategy.FromLocalCache
    *********************************************************/
    test("combined remote & local query gets all customers w/ 'A' (v1 - FetchStrategy) ", function () {
        expect(1);
        var query = getQueryForCustomerA();

        // new 'A' customer in cache ... not saved
        var em = newEm();
        var newCustomer = addCustomer(em, "Acme");

        stop();// going async ..
        executeComboQueryWithFetchStrategy(em, query)
        .then(function (data) { // back from server with combined results

            var customers = data.results;
            ok(customers.indexOf(newCustomer) >= 0,
                 "combo query results should include the unsaved newCustomer, " +
                newCustomer.CompanyName());
        })

        .fail(handleFail)
        .fin(start);
    });
    /*********************************************************
    * Combine remote and local query to get all customers
    * including new, unsaved customers
    * v2=using ExecuteLocally()
    *********************************************************/
    test("combined remote & local query gets all customers w/ 'A' (v2- ExecuteLocally) ", function () {
        expect(1);
        var query = getQueryForCustomerA();

        // new 'A' customer in cache ... not saved
        var em = newEm();
        var newCustomer = addCustomer(em, "Acme");

        stop(); // going async ..
        executeComboQueryWithExecuteLocally(em, query)
        .then(function (data) { // back from server with combined results

            var customers = data.results;
            ok(customers.indexOf(newCustomer) >= 0,
                 "combo query results should include the unsaved newCustomer, " +
                newCustomer.CompanyName());
        })

        .fail(handleFail)
        .fin(start);
    });

    test("combined remote & local query gets all Employees w/ 'A' (v2- ExecuteLocally) ", function () {
        expect(1);
        var em = newEm();

        // create an 'Alice' employee
        em.createEntity('Employee', { FirstName: 'Alice' });

        // query for Employees with names that begin with 'A'
        var query = EntityQuery.from('Employees')
                               .where('FirstName', 'startsWith', 'A')
                               .using(em);

        stop(); // going async ...

        // chain remote and local query execution
        var promise = query.execute()
            .then(function () { // ignore remote query results and chain to local query
                return query.using(breeze.FetchStrategy.FromLocalCache).execute();
            });

        promise.then(function (data) {
            var firstNames = data.results.map(function (emp) { return emp.FirstName(); });
            equal(firstNames.join(', '), "Alice, Andrew, Anne",
                "should have 3 employees with first names: 'Alice, Andrew, Anne'");
        })
        .fail(handleFail)
        .fin(start);
    });

    test("combined remote & local query for 'A' Employees ignores changed 'Anne'.", function () {
        expect(3);
        var em = newEm();
        var anne;
        var anneQuery = EntityQuery.from('Employees')
                                   .where('FirstName', 'eq', 'Anne')
                                   .using(em);

        // query for Employees with names that begin with 'A'
        var query = EntityQuery.from('Employees')
                               .where('FirstName', 'startsWith', 'A')
                               .using(em);

        stop(); // going async ...

        // Get Anne and change her first name
        anneQuery.execute().then(function (data) {
            anne = data.results[0];
            anne.FirstName("Charlene");
        })

        // chain remote and local query execution
        .then(function () {
            return query.execute()
                .then(function () { // ignore remote query results and chain to local query
                    return query.using(breeze.FetchStrategy.FromLocalCache).execute();
                });
        })

        .then(function (data) {
            var firstNames = data.results.map(function (emp) { return emp.FirstName(); });
            equal(firstNames.join(', '), "Andrew",
                "should have 1 employee with first name: 'Andrew'");
            equal(anne && anne.entityAspect.entityState, breeze.EntityState.Modified,
                "the 'Anne' entity should be in cache in the 'Modified' state");
            equal(anne.FirstName(), 'Charlene',
                "the 'Anne' entity should not be included because her local name is 'Charlene'");
        })
        .fail(handleFail)
        .fin(start);
    });
    /*********************************************************
    * Combined query that pours results into a list
    * Caller doesn't have to wait for results
    * Useful in data binding scenarios
    *********************************************************/
    test("query customers w/ 'A' into a list", function () {
        expect(3);
        // list could be an observable array bound to the UI
        var customerList = [];

        var query = getQueryForCustomerA();

        // new 'A' customer in cache ... not saved
        var em = newEm();
        var newCustomer = addCustomer(em, "Acme");

        stop(); // going async ..

        var promise = queryIntoList(em, query, customerList);

        // Application could ignore promise and
        // let observable array update the UI when customers arrive.
        // Our test waits to check that the list was filled
        promise.then(function() {
            var count = customerList.length;
            ok(count > 2,
              "have combined remote/local 'A' customers in list; count = " + count);
            showCustomerResults({ results: customerList });
            ok(customerList.indexOf(newCustomer) >= 0,
                 "combo query results should include the unsaved newCustomer, " +
                newCustomer.CompanyName());
        })
        .fail(handleFail)
        .fin(start);
    });

    // Pours results of any combined query into a list
    // returns a promise to return that list after it's filled
    // Consider for your "DataService" class
    function queryIntoList(em, query, list) {
        list = list || [];
        return executeComboQueryWithFetchStrategy(em, query)
            .then(function (data) {
                data.results.forEach(function (c) { list.push(c); });
                return list;
            });
    }

    /*********************************************************
    * EntityManager.getEntities is not polymorphic
    * 'Around the Horn' orders include regular and 'InternationalOrders'
    * Have to look for both types in cache to get them all
    *********************************************************/
    asyncTest("EntityManager.getEntities is not polymorphic", function () {
        expect(3);
        var em = newEm();
        var query = EntityQuery.from("Orders")
            // known to have a mix of Order types
            .where('Customer.CompanyName', 'eq', 'Around the Horn')
            .expand("Customer");

        em.executeQuery(query)
            .then(getOrdersFromCache).catch(handleFail).fin(start);

        function getOrdersFromCache(data) {
            var cust = em.getEntities('Customer')[0];
            var custOrders = cust.getProperty('Orders');
            var custOrderCount = custOrders.length;
            var qOrders = em.getEntities('Order');
            var qOrderCount = qOrders.length;
            var qInternationalOrders = em.getEntities('InternationalOrder');
            var qInternationalOrderCount = qInternationalOrders.length;

            ok(qOrderCount, "should have some Orders; count = " + qOrderCount);
            ok(qInternationalOrderCount, "should have some InternationalOrders; count = " + qInternationalOrderCount);
            equal(qOrderCount + qInternationalOrderCount, custOrderCount,
                "sum of regular & international orders should = total cust orders, " + custOrderCount);
        }
    });

    /*********************************************************
    * "Query Local" module helpers
    *********************************************************/

    // a query for customers starting with 'A', sorted by name
    function getQueryForCustomerA() {
        return new EntityQuery("Customers")
            .where("CompanyName", "startsWith", "A")
            .orderBy("CompanyName");
    }

    // Execute any query remotely, then execute locally
    // returning the same shaped promise as the remote query
    // Recommended for your "DataService" class
    function executeComboQueryWithFetchStrategy(em, query) {
        query = query.using(em);
        return query.execute()
            .then(function() { // ignore remote query results
                return query.using(breeze.FetchStrategy.FromLocalCache).execute();
            });
    }

    // executeQueryLocally, wrapped in a promise, is the more tedious alternative
    function executeComboQueryWithExecuteLocally(em, query) {
        query = query.using(em);
        return query.execute()
            .then(function () { // ignore remote query results
                return Q.fcall(// return synch query as a promise
                    function () { return { results: query.executeLocally() }; }
                );
            });
    }

    /*** Query By Id (cache or remote) ***/

    module("queryTests (by id)", testFns.getModuleOptions(newEm));

    /*********************************************************
     * Fetch unchanged Customer by key found on server
     *********************************************************/
    test("fetchEntityByKey of Customer found on the server", function () {
        expect(2);
        var em = newEm(); // empty manager

            stop(); // should go async
            em.fetchEntityByKey("Customer", alfredsID,
                // Look in cache first; it won't be there
               /* checkLocalCacheFirst */ true)
              .then(fetchSucceeded)
              .fail(handleFail)
              .fin(start);

            function fetchSucceeded(data) {
                var customer = data.entity;
                var name = customer && customer.CompanyName();
                var entityState = customer && customer.entityAspect.entityState;
                ok(entityState.isUnchanged, "should have found unchanged customer, " + name);
                ok(!data.fromCache, "should have queried the service");
            }
        });
    /*********************************************************
    * Fetch unchanged Customer by key found in cache
    *********************************************************/
    test("fetchEntityByKey of unchanged Customer found in cache", function () {
        expect(2);
        var em = newEm(); // empty manager
            var id = '11111111-2222-3333-4444-555555555555';
            // fake it in cache so we can find it
            attachCustomer(em, id);

            stop(); // actually won't go async
            em.fetchEntityByKey("Customer", id,
               // Look in cache first; it will be there this time
               /* checkLocalCacheFirst */ true)
              .then(fetchUnchangedCustomerByKeySucceeded)
              .fail(handleFail)
              .fin(start);
        });
    /*********************************************************
    * Fetch unchanged Customer by key found in cache using EntityType instead of type name
    *********************************************************/
    test("fetchEntityByKey of unchanged Customer found in cache using EntityType", function () {
        expect(2);
        var em = newEm(); // empty manager
            var id = '11111111-2222-3333-4444-555555555555';
            // fake it in cache so we can find it
            var cust = attachCustomer(em, id);

            stop(); // actually won't go async
            var customerType = cust.entityType;
            em.fetchEntityByKey(customerType, id, true)
              .then(fetchUnchangedCustomerByKeySucceeded)
              .fail(handleFail)
              .fin(start);


        });
    /*********************************************************
    * Fetch unchanged Customer by key found in cache using EntityKey
    *********************************************************/
    test("fetchEntityByKey of unchanged Customer found in cache using EntityKey", function () {
        expect(2);
        var em = newEm(); // empty manager
            var id = '11111111-2222-3333-4444-555555555555';
            // fake it in cache so we can find it
            var cust = attachCustomer(em, id);

            stop(); // actually won't go async
            var key = cust.entityAspect.getKey();
            em.fetchEntityByKey(key, true)
              .then(fetchUnchangedCustomerByKeySucceeded)
              .fail(handleFail)
              .fin(start);


        });
    function fetchUnchangedCustomerByKeySucceeded(data) {
        var customer = data.entity;
        var name = customer && customer.CompanyName();
        var entityState = customer && customer.entityAspect.entityState;
        ok(entityState.isUnchanged, "should have found unchanged customer, " + name);
        ok(data.fromCache, "should have found customer in cache");
    }
    /*********************************************************
     * Fetch OrderDetail by its 2-part key from cache from server
     *********************************************************/
    test("fetchEntityByKey of OrderDetail by 2-part key from server", function () {
        expect(2);
        var em = newEm(); // empty manager
            var orderDetailKey = testFns.wellKnownData.alfredsOrderDetailKey;

            stop(); // should go async
            em.fetchEntityByKey("OrderDetail",
                orderDetailKey.OrderID,
                orderDetailKey.ProductID) // don't bother looking in cache
              //.expand("Product") // sorry ... can't use expand
              .then(fetchSucceeded)
              .fail(handleFail)
              .fin(start);

            function fetchSucceeded(data) {
                var orderDetail = data.entity;
                ok(orderDetail, "should have found OrderDetail for " +
                    JSON.stringify(orderDetailKey));
                ok(!data.fromCache, "should have queried the service");
            }
        });

    /*********************************************************
    * fetchEntityByKey of non-existent Customer returns null
    *********************************************************/
    test("fetchEntityByKey of non-existent Customer returns null", function () {
        expect(2);
        var em = newEm(); // empty manager
        var id = '11111111-2222-3333-4444-555555555555';

        stop(); // should go async
        em.fetchEntityByKey("Customer", id,
           /* checkLocalCacheFirst */ true)
          .then(fetchSucceeded)
          .fail(handleFail)
          .fin(start);

        function fetchSucceeded(data) {
            // fetch "succeeds" even when entity is not found
            // "success" == "did not break"
            ok(data.entity == null, "should not find customer with id " + id);
            ok(!data.fromCache, "should have checked the server");
        }
    });
    /*********************************************************
    * fetchEntityByKey of Customer marked-for-delete returns null
    *********************************************************/
    test("fetchEntityByKey of Customer marked-for-delete returns null", function () {
        expect(2);
        var em = newEm(); // empty manager
        var id = '11111111-2222-3333-4444-555555555555';
        // fake it in cache so we can find it
        var customer = attachCustomer(em, id);
        customer.entityAspect.setDeleted();

        /*
        // but if we included deletes like this, the manager would return the deleted entity
        em.setProperties({
            queryOptions: em.queryOptions.using({ includeDeleted: true })
        });
       */

        stop(); // actually won't go async
        em.fetchEntityByKey("Customer", id,
           /* checkLocalCacheFirst */ true)
          .then(fetchSucceeded)
          .fail(handleFail)
          .fin(start);

        function fetchSucceeded(data) {
            // fetch "succeeds" even when entity is deleted
            // "success" == "did not break"
            ok(data.entity == null, "should not find deleted customer with id " + id);
            ok(data.fromCache, "should NOT have checked the server");
        }
    });
    /*********************************************************
    * getEntityByKey of Customer marked-for-delete returns the deleted entity
    * getEntityByKey is a synchronous method that only looks at cache
    *********************************************************/
    test("getEntityByKey of Customer marked-for-delete returns the deleted entity", function () {
        expect(2);
        var em = newEm(); // empty manager
        var id = '11111111-2222-3333-4444-555555555555';
        // fake it in cache so we can find it
        var customer = attachCustomer(em, id);
        customer.entityAspect.setDeleted();

        var entity = em.getEntityByKey("Customer", id);

        ok(entity == customer, "should find deleted customer with id " + id);
        equal(entity.entityAspect.entityState.name, "Deleted",
            "customer should be in 'Deleted' state.");
    });
    /*********************************************************************
     * This portion of the "queryTests (by id)" module
     * tests a hand-built async getById utility that was the way to do it
     * before EntityManager.fetchEntityByKey
     * A curiosity now.
     ********************************************************************/

    // This hand-built async getById utility method returns a promise.
    // A successful promise returns the entity if found in cache
    // or if found remotely.
    // Returns null if not found or if found in cache but is marked deleted.
    // Caller should check for query failure.
    // 'queryResult' reports if queried the remote service
    // and holds a found entity even if it is marked for deletion.
    //
    // This fnc has been largely replaced by EntityManager.fetchEntityByKey.
    function getByIdCacheOrRemote(manager, typeName, id, queryResult) {
        // get key for entity of specified type and id
        var typeInfo = manager.metadataStore.getEntityType(typeName);
        var key = new breeze.EntityKey(typeInfo, id);

        // look in cache first
        var entity = manager.getEntityByKey(key);
        if (entity) {
            queryResult.queriedRemotely = false; // found it in cache
            queryResult.entity = entity;
            // return entity, wrapped in promise (set null if deleted)
            return Q((entity.entityAspect.entityState.isDeleted()) ?
                    null : entity); // return null if marked for delete!
        }
        // not in cache; try remotely
        queryResult.queriedRemotely = true; // queried the service
        return EntityQuery
            .fromEntityKey(key)
            .using(manager).execute()
            .then(function (data) {
                entity = data.results[0] || null;
                return queryResult.entity = entity;
            });
    }

    /*********************************************************
     * [obsolete] Get unchanged customer by id from cache from server
     *********************************************************/
    test("getById of unchanged customer from server [obsolete]", function () {
        expect(2);
        var em = newEm(); // empty manager
            var queryResult = { };

            stop(); // might go async
            getByIdCacheOrRemote(em, "Customer", alfredsID, queryResult)
            .then(querySucceeded).fail(handleFail).fin(start);

            function querySucceeded(customer) {
                var name = customer && customer.CompanyName();
                var entityState = customer && customer.entityAspect.entityState;
                ok(entityState.isUnchanged, "should have found unchanged customer, "+name);
                ok(queryResult.queriedRemotely, "should have queried the service");
            }
        });
    /*********************************************************
    * Get unchanged customer by id from cache
    *********************************************************/
    test("getById of unchanged customer from cache [obsolete]", function () {
        expect(2);
        var em = newEm(); // empty manager
            var queryResult = {};
            attachCustomer(em, alfredsID);

            stop(); // might go async
            getByIdCacheOrRemote(em, "Customer", alfredsID, queryResult)
            .then(querySucceeded).fail(handleFail).fin(start);

            function querySucceeded(customer) {
                var name = customer && customer.CompanyName();
                var entityState = customer && customer.entityAspect.entityState;
                ok(entityState.isUnchanged, "should have found unchanged customer, " + name);
                ok(!queryResult.queriedRemotely, "should have found customer in cache");
            }
        });
    /*********************************************************
    * getById of deleted customer in cache returns null
    *********************************************************/
    test("getById of deleted customer in cache returns null [obsolete]", function () {
        expect(3);
        var em = newEm(); // empty manager
            var queryResult = {};
            var cust = attachCustomer(em, alfredsID);
            cust.entityAspect.setDeleted();

            stop(); // might go async
            getByIdCacheOrRemote(em, "Customer", alfredsID, queryResult)
            .then(querySucceeded).fail(handleFail).fin(start);

            function querySucceeded(customer) {
                ok(customer === null,
                    "query should return null because customer marked for deletion");
                customer = queryResult.entity; // we remembered it for the test
                var name = customer && customer.CompanyName();
                var entityState = customer && customer.entityAspect.entityState;
                ok(entityState.isDeleted, "should have found deleted customer, " + name);
                ok(!queryResult.queriedRemotely, "should have found deleted customer in cache");
            }
        });
     /*********************************************************
     * getById of non-existent customer returns null after looking in cache and server
     *********************************************************/
     test("getById of non-existent customer returns null [obsolete]", function () {
        expect(2);
        var em = newEm(); // empty manager
            var id = '11111111-2222-3333-4444-555555555555';
            var queryResult = {};

            stop(); // might go async
            getByIdCacheOrRemote(em, "Customer", id, queryResult)
            .then(querySucceeded).fail(handleFail).fin(start);

            function querySucceeded(customer) {
                ok(customer === null,
                    "query should return null because customer doesn't exist");
                ok(queryResult.queriedRemotely, "should have queried the server");
            }
        });

    /*** Query Xtras ***/

     module("queryTests (refresh)", testFns.getModuleOptions(newEm));

     asyncTest("can refresh an unmodified Employee entity", function () {
         var em = newEm();
         var emp1 = em.createEntity('Employee', {
             EmployeeID: 1,
             FirstName: 'Eeny',
             LastName: 'Beany'
         }, UNCHANGED);

         EntityQuery.fromEntities([emp1])
             .using(em).execute()
             .then(function () {
                 ok(emp1.getProperty('FirstName').indexOf('Nancy') === 0,
                   "should update FirstName from db");
             })
             .catch(handleFail).finally(start);
     });

     asyncTest("can refresh an unmodified Customer entity", function () {
         var em = newEm();
         var cust = em.createEntity('Customer',
             { CustomerID: alfredsID, CompanyName: 'Acme' }, UNCHANGED);

         EntityQuery.fromEntities(cust) // can skip the array if only one
             .using(em).execute()
             .then(function () {
                 ok(cust.getProperty('CompanyName').indexOf('Alfreds') === 0,
                   "should update CompanyName from db");
             })
             .catch(handleFail).finally(start);
     });

     asyncTest("can refresh unmodified entities of the same type", function () {
         var em = newEm();
         var emp1 = em.createEntity('Employee', {
             EmployeeID: 1,
             FirstName: 'Eeny',
             LastName: 'Beany'
         }, UNCHANGED);

         var emp2 = em.createEntity('Employee', {
             EmployeeID: 2,
             FirstName: 'Meeny',
             LastName: 'Beany'
         }, UNCHANGED);

         EntityQuery.fromEntities([emp1, emp2])
             .using(em).execute()
             .then(function () {
                 ok(emp1.getProperty('FirstName').indexOf('Nancy') === 0,
                   "should update FirstName from db");
                 ok(emp2.getProperty('FirstName').indexOf('Andrew') === 0,
                   "should update FirstName from db");
             })
             .catch(handleFail).finally(start);
     });

     // D#2655
     test("'EntityQuery.fromEntities' can NOT refresh entities of different types", function () {
         var em = newEm();
         var emp1 = em.createEntity('Employee', {
             EmployeeID: 1,
             FirstName: 'Eeny',
             LastName: 'Beany'
         }, UNCHANGED);

         var cust = em.createEntity('Customer',
             { CustomerID: alfredsID, CompanyName: 'Acme' }, UNCHANGED);

         throws(function() {
             EntityQuery.fromEntities([emp1, cust]);
         }, /not of type/, "raised error because not all entities are the same type");
     });

     asyncTest("will NOT refresh a modified entity", function () {
         var em = newEm();
         var emp1 = em.createEntity('Employee', {
             EmployeeID: 1,
             FirstName: 'Eeny',
             LastName: 'Beany'
         }, UNCHANGED);
         emp1.setProperty('FirstName', 'Changed');

         EntityQuery.fromEntities([emp1])
             .using(em).execute()
             .then(function () {
                 ok(emp1.getProperty('FirstName').indexOf('Nancy') === -1,
                   "should NOT update FirstName from db");
             })
             .catch(handleFail).finally(start);
     });

     asyncTest("will refresh a modified entity if 'OverwriteChanges'", function () {
         var em = newEm();
         var emp1 = em.createEntity('Employee', {
             EmployeeID: 1,
             FirstName: 'Eeny',
             LastName: 'Beany'
         }, UNCHANGED);
         emp1.setProperty('FirstName', 'Changed');

         EntityQuery.fromEntities([emp1])
             .using(breeze.MergeStrategy.OverwriteChanges)
             .using(em).execute()
             .then(function () {
                 ok(emp1.getProperty('FirstName').indexOf('Nancy') === 0,
                   "shouldupdate FirstName from db");
             })
             .catch(handleFail).finally(start);
     });
    /*********************************************************
    * Test helpers
    *********************************************************/

     // create a new Customer and add to the EntityManager
     function addCustomer(em, name) {
         var cust = em.createEntity('Customer', {
             CustomerID: testFns.newGuidComb(),
             CompanyName: name || 'a-new-company'
         });
         return cust;
     }

    // create a Customer and attache to manager
    // as if queried and unchanged from server
     function attachCustomer(manager, id) {
         var customer = manager.createEntity('Customer', {
             CustomerID: id,
             CompanyName: "Test Customer"
         }, UNCHANGED);
         return customer;
    }

})(docCode.testFns);