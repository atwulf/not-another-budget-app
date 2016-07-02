var db = require('mongoose');
var numeral = require('numeral');
var moment = require('moment');

/**
 * status
 *
 * Determines whether a given category
 * of transaction is on budget.
 */

var status = function status(req, res, next) {
  var t = db.model('transactions').find();
  var b = db.model('budgets').findOne();
  var category = { category: req.params.category };

  t = t.where(category);
  b = b.where(category);

  // first, get transactions
  t.exec(function(err, list) {
    if (err) next(err);

    // count up total
    var total = list.reduce(function(sum, t) {
      return sum + t.amount;
    }, 0);

    // next, get budget
    b.exec(function(err, budget) {
      if (err) next(err);

      var amt = budget.amount;
      var isOver = (total > amt);
      var diff = Math.abs(total - amt);

      res.send({
        budget: budget,
        isOver: isOver,
        difference: diff
      });
    });
  });
};

/**
 * statusAll
 *
 * Returns a list of all budgets
 * including the status of each.
 */

var statusAll = function statusAll(cb, errorHandler, opts) {
  var t = db.model('transactions').find();
  var b = db.model('budgets').find();

  var currentDate = moment().set({ year: opts.year, month: opts.month });
  var dateMin = currentDate.clone().startOf('month');
  var dateMax = currentDate.clone().endOf('month');

  // filter transactions by date
  t = t.where('date')
    .gte(dateMin.toDate())
    .lte(dateMax.toDate());

  // first, get transactions
  t.exec(function(err, list) {
    if (err) errorHandler(err);

    // get categories by category
    var categories = list.reduce(function(obj, l) {
      var prev = obj[l.category] || 0;
      obj[l.category] = prev + l.amount;
      return obj;
    }, {});

    // next, get budgets
    b.exec(function(err, budgets) {
      if (err) errorHandler(err);

      // build array of budget objects
      var resp = budgets.map(function(x) {
        var cat = x.category;
        var amt = x.amount;
        var total = categories[cat];
        var totalSpent = Math.abs(total) || 0;
        var isOver = (totalSpent > amt);
        var remainder = (amt - totalSpent);

        return {
          _id: x._id,
          category: cat,
          amount: amt,
          totalSpent: totalSpent,
          remainder: remainder,
          isOver: isOver
        };
      });

      // build totals object
      var budget = budgets.reduce(function(sum, b) {
        return sum += b.amount;
      }, 0);

      var spent = list.reduce(function(sum, t) {
        if (t.amount > 0) return sum;
        return sum += t.amount;
      }, 0);

      var totals = {
        budget: budget,
        spent: spent,
        remainder: (budget + spent)
      };

      var existingBudgets = budgets.map(function(b) {
        return b.category;
      });

      var neededBudgets = Object.keys(categories)
        .filter(function(c) {
          return existingBudgets.indexOf(c) === -1;
        });

      cb(resp, totals, neededBudgets);
    });
  });
};

/**
 * get
 *
 * Returns a list of all budgets or
 * a specific budget given a category name.
 */

var get = function get(req, res, next) {
  var b = db.model('budgets').find();
  var category = req.params.category;

  if (category) b = b.where({ category: category });

  b.exec(function(err, list) {
    if (err) next(err);
    res.send(list);
  });
};

/**
 * post
 *
 * Creates a new budget given
 * some data.
 */

var post = function post(req, res, next) {
  var amount = req.body.amount || 0;
  var category = req.body.category || 'Default';

  db.model('budgets').create({
    amount: amount,
    category: category
  }, function(err) {
    if (err) next(err);
    res.redirect('/budgets');
  });
};

/**
 * put
 *
 * Updates a specific budget given
 * an id and some changes.
 */

var put = function put(req, res, next) {
  var id = req.body.id;
  var amount = req.body.amount;
  var category = req.body.category;

  db.model('budgets').findById(id, function(err, b) {
    if (err) next(err);

    if (amount) b.amount = parseFloat(amount.replace(/\$|\,/g, ''));
    if (category) b.category = category.trim();

    b.save(function(err) {
      if (err) next(err);
      b.amount = numeral(b.amount).format('$0,0.00');
      res.send(b);
    });
  });
};

/**
 * remove
 *
 * Deletes a specific budget given
 * an id.
 */

var remove = function remove(req, res, next) {
  db.model('budgets').findByIdAndRemove(req.params.id, function(err) {
    if (err) return next(err);
    res.send({ status: 200, message: 'Successfully removed budget ' + req.params.id });
  });
};

/**
 * render
 *
 * Renders the view for budgets.
 */

var render = function render(req, res, next) {
  var now = moment();
  var year = req.params.year ? parseInt(req.params.year, 10) : now.year();
  var month = req.params.month ? parseInt(req.params.month, 10) - 1 : now.month();
  var date = moment().set({ year: year, month: month });

  statusAll(function(budgets, totals, categories) {
    res.render('budgets', {
      viewName: 'budgets',
      budgets: budgets.sort(function(a, b) {
        var x = a.category.toLowerCase();
        var y = b.category.toLowerCase();

        if (x < y) return -1;
        if (x > y) return 1;
        return 0;
      }),
      totals: totals,
      categories: categories.sort(),
      date: date.format('MMMM YYYY'),
      currentDate: {
        month: date.format('MM'),
        year: date.format('YYYY')
      }
    });
  }, next, {
    year: year,
    month: month
  });
};

module.exports = {
  get: get,
  post: post,
  put: put,
  remove: remove,
  status: status,
  render: render
};
