var loadScript = function(url, callback){
var script = document.createElement("script");
script.type = "text/javascript";
if (script.readyState){  // IE
script.onreadystatechange = function(){
if (script.readyState == "loaded" || script.readyState == "complete"){
script.onreadystatechange = null;
callback();
}
};
} else {  // Others
script.onreadystatechange = callback;
script.onload = callback;
}

script.src = url;
var x = document.getElementsByTagName('script')[0]; x.parentNode.insertBefore(script, x);
};

    var startProductLabel2 = function(SECOMAPP, jQuery) {
SECOMAPP.cookie=function(b,j,m){if(typeof j!="undefined"){m=m||{};if(j===null){j="";m.expires=-1}var e="";if(m.expires&&(typeof m.expires=="number"||m.expires.toUTCString)){var f;if(typeof m.expires=="number"){f=new Date();f.setTime(f.getTime()+(m.expires*24*60*60*1000))}else{f=m.expires}e="; expires="+f.toUTCString()}var l=m.path?"; path="+(m.path):"";var g=m.domain?"; domain="+(m.domain):"";var a=m.secure?"; secure":"";document.cookie=[b,"=",encodeURIComponent(j),e,l,g,a].join("")}else{var d=null;if(document.cookie&&document.cookie!=""){var k=document.cookie.split(";");for(var h=0;h
<k.length;h++){var c=jQuery.trim(k[h]);if(c.substring(0,b.length+1)==(b+"=")){d=decodeURIComponent(c.substring(b.length+1));break}}}return d}};

    SECOMAPP.plCookie = {
        configuration: {
            expires: 365,
            path: '/',
            domain: window.location.hostname
        },
        name: 'scm_product_label_app',
        count: 'scm_product_label_count',
        isInstalled: function() {
            var count = SECOMAPP.cookie(this.count);
            if (! count) count = 0;
            count++;
            SECOMAPP.cookie(this.count, count, this.configuration);

            var scripts = document.head.getElementsByTagName('script');
            for (var i = 0; i < scripts.length; ++i) {
                if(scripts[i].innerText.indexOf('asyncLoad') >= 0 && scripts[i].innerText.indexOf("d3azqz9xba9gwd.cloudfront.net") >= 0) {
                    console.log('already has scripttag, load PL');
                    return true;
                }
            }
            
            return SECOMAPP.cookie(this.name) === "installed" && count < 3;
        },
    };

    if (SECOMAPP.page == 'product' && SECOMAPP.pl.overrideUpdateSelectors !== true) {
        if ((typeof Shopify) !== 'undefined' && (typeof Shopify.OptionSelectors) !== 'undefined')  {
            var skip = false;
            if ((typeof Shopify.urlParam) !== 'undefined')  {
                if (Shopify.urlParam("variant")) {
                    skip = true;
                }
            }

            if (! skip) {
                try {
                    Shopify.OptionSelectors.prototype.updateSelectors = function (index, options) {
                        var currValues = this.selectedValues(); // get current values
                        var variant = this.product.getVariant(currValues);
                        if (variant) {
                            this.variantIdField.disabled = false;
                            this.variantIdField.value = variant.id; // update hidden selector with new variant id
                        } else {
                            this.variantIdField.disabled = true;
                        }
                        this.onVariantSelected(variant, this, options); // callback
                        if (this.historyState != null) {
                            this.historyState.onVariantChange(variant, this, options);
                        }

                        if (!this.variantIdField.disabled) {
                            if (this.historyState == null) {
                                if ((typeof SECOMAPP.pl.showLabel) !== 'undefined') {
                                    SECOMAPP.pl.showLabel(this.variantIdField.value );
                                }
                            }
                        }
                    };

                    SECOMAPP.pl.overrideUpdateSelectors = true;
                } catch(err) {
                    console.log('SECOMAPP PL OptionSelectors version mismatch');
                }
            }
        }
    }

    if (! SECOMAPP.plCookie.isInstalled()) {
        return;
    }
    if (SECOMAPP.pl.loadedApp === true) {
        return;
    }

if ((typeof SECOMAPP) == 'undefined') {
        var SECOMAPP = {
            getCustomMarginWL: undefined
        };
    }
    if ((typeof SECOMAPP.pl) == 'undefined') {
        SECOMAPP.pl = {};
    }

    //label infos
    SECOMAPP.pl.labels = [
                    {
            'id': 49427,
            'priority': 0,
            'hide': 0,
            'image': '',
                        'text': "Bán chạy",
                        'position': 'top_right',
            'styles': '',
            'text_styles': '',
            'label_width': 23,
            'label_height': 8,
            'fixed_size': 0,
            'page': 'product,collection,home,search',
            'label_type': 1,
            'ignore_page': '',
            'top': 0,
            'left': 0,
            'customize_position': 0,
            'rotate': 0,
            'opacity': 1,
            'link': '',
            'alt': '',
            'tooltip': '',
            'animation': 'none',
            'margin': {
                'top':0,
                'left':0,
                'right':0,
                'bottom':0,
            },
            'conditions': {
                                'variant_apply': 'variants',
                                
                'exclude_variants': '',
                'include_variants': '47393293304117,47393293336885,47393293369653,47393293402421,47393302151477,47393302184245,47393302217013,47393302249781,47393303855413,47393303888181,47393303920949,47393303953717,47404381045045,47404381077813,47404381110581,47404381143349,47404381176117,47404406604085,47404406636853,47404406669621,47404406702389,47404406735157,47404415680821,47404415713589,47404415779125,47404415811893,47404415844661,47404419252533,47404419285301,47404419318069,47404419350837,47404419383605,46742756622645,46742756753717,46742756884789,46742757015861,46742757179701,46804770390325,46804770423093,46804770455861,46804770488629,46804770521397,46831114027317,46831114256693,46831114289461,46831114322229,46831114354997,46831510356277,46831510847797,46831510880565,46831510913333,46831510946101,47404065390901,47404065423669,47404065456437,47404065489205,47404065521973,47404111855925,47404111888693,47404111921461,47404111954229,47404111986997,47404123095349,47404123128117,47404123160885,47404123193653,47404123226421,47404352536885,47404352569653,47404352602421,47404352635189,47404352667957,47393313063221,47393313095989,47393313128757,47393313161525,47393341407541,47393341473077,47393341505845,47393341538613,47393343111477,47393343144245,47393343177013,47393343209781,47393345438005,47393345470773,47393345503541,47393345536309',
                                                                'is_new': 'any',
                                                'is_on_sale': 'any',
                                                                                                                'stock_status': 'any',
                                                                'by_price': 'base_price',
                                                                                                    'discount_from': 0,
                                                    'discount_to': 10,
                                                                    'discount_by': 'percentage',
                                                    'discount_type': 'fixed',
                                                    'stock_from': 0,
                                                    'stock_to': 10,
                                                                                    'new_days_threshold': 10,
                                                    'low_stock_threshold': 1,
                                                    'product_stock_computation': 'per_variant',
                            },
            'design': {
                                                'border': {
                    'size' : 0,
                    'color' : '#FFFFFF',
                    'style' : 'none'
                },
                                                'shape_color': '#d02545',
                                                'text_color': '#FFFFFF',
                                                'font_family': 'Arial',
                                                'font_size': 18,
                                                'font_style': {
                    'style': 'normal',
                    'weight': 'bold',
                    'decoration': 'none',
                },
                                                                'shape_class': 'pl-text-left-point',
                                            },
            'group_ids': '',
        },
            ];

    SECOMAPP.pl.groups = [
                ];

    SECOMAPP.isDefined = function (obj) {
        return ((typeof obj != 'undefined'));
    };
    SECOMAPP.getPositionLeft = function (elem) {
        return elem.position() !== 'undefined' ? elem.position().left : 0;
    };
    SECOMAPP.getPositionTop = function (elem) {
        return elem.position() !== 'undefined' ? elem.position().top : 0;
    };
    SECOMAPP.getMarginWL = function (elem, strCssRule) {
        if (typeof SECOMAPP.getCustomMarginWL === 'function') {
            return SECOMAPP.getCustomMarginWL(elem, strCssRule);
        }
        if (navigator.userAgent.search("Firefox") > -1) {
            if (typeof elem.get(0) === 'undefined') {
                return 0;
            }
            var computedStyle = window.getComputedStyle(elem.get(0));
            return parseInt(computedStyle.marginLeft, 10);
        } else {
            return (elem.outerWidth(true) - elem.outerWidth()) / 2;
        }
    };
    SECOMAPP.getMarginWR = function (elem, strCssRule) {
        if (typeof SECOMAPP.getCustomMarginWR === 'function') {
            return SECOMAPP.getCustomMarginWL(elem, strCssRule);
        }
        if (navigator.userAgent.search("Firefox") > -1) {
            if (typeof elem.get(0) === 'undefined') {
                return 0;
            }
            var computedStyle = window.getComputedStyle(elem.get(0));
            return parseInt(computedStyle.marginRight, 10);
        } else {
            return (elem.outerWidth(true) - elem.outerWidth()) / 2;
        }
    };
    SECOMAPP.getMarginW = function (elem) {
        var margT;
        if (navigator.userAgent.search("Firefox") > -1) {
            margT = elem.parent().outerWidth(true) - elem.width();
        } else {
            margT = elem.outerWidth(true) - elem.outerWidth();
        }
        return margT / 2;
    };
    SECOMAPP.getMarginH = function (elem) {
        return (elem.outerHeight(true) - elem.outerHeight()) / 2;
    };
    SECOMAPP.getPadding = function (elem) {
        return elem.innerWidth() - elem.width();
    };
    SECOMAPP.decode = function (text) {
        var txt = document.createElement("textarea");
        txt.innerHTML = text;
        return txt.value;
    }

    SECOMAPP.pl.labelProduct = function () {
        var image = getProductImage();
        // check flex-slider
        if ((typeof SECOMAPP.pl.lpPath) != 'undefined') {
            imageParent = image.parents(SECOMAPP.pl.lpPath).first();
        } else {
            imageParent = image.parents(":not(a):not(.zoomWrapper)").first();
        }
        imageParent.addClass("pl-parent");

        // get customized xpath for label
        if (image && image.length > 0) {
            imageParent.prepend('<div class="pl-container pl-product">');
            var width = image.width() > 0 ? image.width() : 0;
            if (width === 0 && image.get(0)) {
                width = image.get(0).width;
            }
            var height = image.height() > 0 ? image.height() : 0;
            if (height === 0 && image.get(0)) {
                height = image.get(0).height;
            }
            var elemPl = jQuery('.pl-container');
            elemPl.css({
                "margin-left": SECOMAPP.getMarginWL(image),
                "margin-right": SECOMAPP.getMarginWR(image),
                "margin-top": SECOMAPP.getMarginH(image),
                "margin-bottom": SECOMAPP.getMarginH(image),
                padding: SECOMAPP.getPadding(image),
            });
            if (width > 0) {
                elemPl.css({width: width});
            }
            if (height > 0) {
                elemPl.css({height: height});
            }
            var variantId = getVariantId();
            if (!variantId) {
                // get first available variant
                for (var i = 0; i < SECOMAPP.pl.product.variants.length; i++) {
                    var variant = SECOMAPP.pl.product.variants[i];
                    if (variant.inventory_quantity > 0 || !variant.hasOwnProperty('inventory_management')) {
                        variantId = variant.id;
                        break;
                    }
                }
            }
            if (!variantId) {
                variantId = SECOMAPP.pl.product.variants[0].id;
            }
            SECOMAPP.pl.showLabel(variantId);
        }
    };

    SECOMAPP.pl.labelCollections = function (force) {
        var productImages = getProductImages();

        searchCallback = function (json) {
            if ((typeof SECOMAPP.pl.products) == 'undefined') {
                SECOMAPP.pl.products = {};
            }

            json.results.forEach(function (product) {
                if (product.variants.length !== 0) {
                    SECOMAPP.pl.products[product.handle] = product;
                    product.published_at = product.published_at.replace(/(\d)-/g, '$1/');

                    handle = product.handle;

                    var productImage = productImages[handle];
                    if (productImage instanceof Array) {
                        productImage.forEach(function (pi) {
                            showLabelImage(pi, handle);
                        });
                    } else {
                        showLabelImage(productImage, handle);
                    }
                } else {
                    console.log('have empty variants in product');
                }
            });

            if (json.results_count > 50 && ((typeof SECOMAPP.pl.search) == 'undefined' || !SECOMAPP.pl.search.hasOwnProperty(json.query))) {
                if ((typeof SECOMAPP.pl.search) == 'undefined') {
                    SECOMAPP.pl.search = {};
                }
                SECOMAPP.pl.search[json.query] = true;
                for (var page = 2; page <= Math.floor((json.results_count + 49) / 50); page++) {
                    var query = json.query.split('&quot;').join('"');
                    jQuery.getScript('/search.js?page=' + page + '&q=' + query + '&view=scm.products.handle.js&_sc=1&design_theme_id=163866378549&app=pl');
                }
            }
        };

        // get products json from handles
        var fullQuery = "";
        var h = 0;
        for (var handle in productImages) {
            if (!productImages.hasOwnProperty(handle)) {
                continue;
            }

            if (typeof (force) !== 'undefined' && force === true) {
                SECOMAPP.pl.productImages = {};
            }
            if (typeof SECOMAPP.pl.productImages == "undefined") {
                SECOMAPP.pl.productImages = {};
            }
            if (SECOMAPP.pl.productImages.hasOwnProperty(handle)) {
                continue;
            } else {
                SECOMAPP.pl.productImages[handle] = productImages[handle];
            }

            if (fullQuery.length > 0) {
                fullQuery += " OR ";
            }
            fullQuery += "handle:\"" + handle + "\"";
            h++;
            if (h >= 50) {
                jQuery.getScript('/search.js?q=' + fullQuery + '&view=scm.products.handle.js&_sc=1&design_theme_id=163866378549&app=pl');
                fullQuery = "";
                h = 0;
            }
        }
        if (h > 0) {
            jQuery.getScript('/search.js?q=' + fullQuery + '&view=scm.products.handle.js&_sc=1&design_theme_id=163866378549&app=pl');
        }
    };

    //get matched label
    SECOMAPP.pl.showLabel = function (variantId) {
        jQuery('.pl-container.pl-product .pl-image').hide();
        var product = SECOMAPP.pl.product;
        product.published_at = product.published_at.replace(/(\d)-/g, '$1/');
        // find the variant object
        for (i = product.variants.length - 1; i >= 0; i--) {
            var variant = product.variants[i];
            if (Number(variantId) === variant.id) {
                break;
            }
        }

        var labels = SECOMAPP.pl.labels;
        var sku;
        var groups = SECOMAPP.pl.groups;
          var match_count = 0;
          for (var j = 0; j < labels.length; j++) {
              var label = labels[j];
              if (label.page.indexOf('product') === -1) {
                  continue;
              }


              var condition = label.conditions;
              var design = label.design;
                var group_ids = label.group_ids.split(',').map(Number);
              var match = true;

              // Hide if label with higher priority is already applied
              if (label.hide) {
                  if (match_count > 0) {
                      continue;
                  }
              }

            var label_groups = groups.map((group) => {
                if (group_ids.includes(group.id)) {
                    return group;
                }
            });

            if (document.querySelector('.pl-container.pl-product .pl-image[data-label-id="'+ label.id +'"]')) {
                match_count++;
                continue;
            }

            var compare_at_price_threshold;
            if (condition.is_on_sale === 'yes') {
                if (match) {
                    // Is On Sale
                    if (!variant.hasOwnProperty('compare_at_price') || variant.compare_at_price == null) {
                        match = false;
                    } else if (variant.price < variant.compare_at_price) {
                        var sale = variant.compare_at_price - variant.price;

                        if (condition.discount_by === 'percentage') {
                            sale = sale / variant.compare_at_price * 100;
                        }

                        if (condition.discount_by === 'amount') {
                            sale = sale / 100;
                        }

                        if (condition.discount_type === 'fixed') {
                            if (sale !== condition.discount_fixed) {
                                match = false;
                            }
                        } else if (condition.discount_type === 'range') {
                            if (condition.discount_from && condition.discount_to) {
                                if (sale < condition.discount_from || sale > condition.discount_to) {
                                    match = false;
                                }
                            } else if (condition.discount_from) {
                                if (sale < condition.discount_from) {
                                    match = false;
                                }
                            } else if (condition.discount_to) {
                                if (sale > condition.discount_to) {
                                    match = false;
                                }
                            }
                        }
                    } else {
                        match = false;
                    }
                }
            } else if (condition.is_on_sale === 'no') {
                if (match) {
                    if (variant.hasOwnProperty('compare_at_price')) {
                        if (variant.price < variant.compare_at_price) {
                            match = false;
                        }
                    }
                }
            }

            // Is New
            var published_arr = product.published_at.split(" ");
            var published_at = published_arr[0] + ' ' + published_arr[1];
            if (condition.is_new === 'yes') {
                // Last X Days
                if (match) {
                    if ((new Date() - Date.parse(published_at)) / 86400000 > condition.new_days_threshold){
                        match = false;
                    }
                }
            } else if (condition.is_new === 'no') {
                // Last X Days
                if (match) {
                    if ((new Date() - Date.parse(published_at)) / 86400000 <= condition.new_days_threshold) {
                        match = false;
                    }
                }
            } else if (condition.is_new === 'date_range') {
                if (match) {
                    if (condition.new_date_from && condition.new_date_to) {
                        if (Date.parse(published_at) < Date.parse(condition.new_date_from) || Date.parse(published_at) > Date.parse(condition.new_date_to)) {
                            match = false;
                        }
                    } else if (condition.new_date_from) {
                        if (Date.parse(published_at) < Date.parse(condition.new_date_from)) {
                            match = false;
                        }
                    } else if (condition.new_date_to) {
                        if (Date.parse(published_at) > Date.parse(condition.new_date_to)) {
                            match = false;
                        }
                    }
                }
            }

              // Collections
              if (condition.collections) {
                  var collections = condition.collections.split(',').map(x => +x)
                  if (match) {
                      match = false;
                      for (i = 0; i < product.collections.length; i++) {
                          var cId = product.collections[i];
                          if (collections.indexOf(cId) >= 0) {
                              match = true;
                              break;
                          }
                      }
                  }
              }

              // Exclude Collections
              if (condition.exclude_collections) {
                  var exclude_collections = condition.exclude_collections.split(',').map(x => +x)
                  if (match) {
                      for (i = 0; i < product.collections.length; i++) {
                          var cid = product.collections[i];
                          if (exclude_collections.indexOf(cid) >= 0) {
                              match = false;
                              break;
                          }
                      }
                  }
              }

              // Tags
              if (condition.tags) {
                  var tags = condition.tags.split(',')
                  if (match) {
                      match = false;

                      if (product.hasOwnProperty('tags')) {
                          for (i = 0; i < product.tags.length; i++) {
                              if (tags.indexOf(product.tags[i]) >= 0) {
                                  match = true;
                                  break;
                              }
                          }
                      }
                  }
              }

              // Exclude Tags
              if (condition.exclude_tags) {
                  var exclude_tags = condition.exclude_tags.split(',')
                  if (match) {
                      if (product.hasOwnProperty('tags')) {
                          for (i = 0; i < product.tags.length; i++) {
                              if (exclude_tags.indexOf(product.tags[i]) >= 0) {
                                  match = false;
                                  break;
                              }
                          }
                      }
                  }
              }

            // Stock
            if (condition.stock_status === 'in_stock') {
                if (match) {
                    // in stock
                    if (variant.inventory_quantity <= 0 && variant.hasOwnProperty('inventory_management')) {
                        match = false;
                    }
                }
            } else if (condition.stock_status === 'out_of_stock') {
                if (match) {
                    // out of stock
                    if (variant.inventory_quantity > 0 || !variant.hasOwnProperty('inventory_management')) {
                        match = false;
                    }
                }
            } else if (condition.stock_status === 'low_stock') {
                if (match) {
                    // low stock
                    if (variant.inventory_quantity <= 0 || variant.inventory_quantity > condition.low_stock_threshold || !variant.hasOwnProperty('inventory_management')) {
                        match = false;
                    }
                }
            } else if (condition.stock_status === 'stock_range') {
                if (match) {
                    // stock range
                    if (!variant.hasOwnProperty('inventory_management')) {
                        match = false;
                    } else {
                        if (condition.stock_from && condition.stock_to) {
                            if (variant.inventory_quantity < condition.stock_from || variant.inventory_quantity > condition.stock_to ) {
                                match = false;
                            }
                        } else if (condition.stock_from) {
                            if (variant.inventory_quantity < condition.stock_from) {
                                match = false;
                            }
                        } else if (condition.stock_to) {
                            if (variant.inventory_quantity > condition.stock_to) {
                                match = false;
                            }
                        }
                    }
                }
            }

            // Price Range
            if (condition.hasOwnProperty('from_price') || condition.hasOwnProperty('to_price')) {
                if (match) {
                    if (condition.hasOwnProperty('from_price')) {
                        if (variant.price < condition.from_price * 100) {
                            match = false;
                        }
                    }
                    if (condition.hasOwnProperty('to_price') && match) {
                        if (match === true && variant.price > condition.to_price * 100) {
                            match = false;
                        }
                    }
                }
            }

              // Weight Range
              if (condition.hasOwnProperty('from_weight') || condition.hasOwnProperty('to_weight')) {
                  if (match) {
                      if (condition.hasOwnProperty('from_weight')) {
                          if (!variant.hasOwnProperty('weight') || variant.weight === 0 || variant.weight < condition.from_weight) {
                              match = false;
                          }
                      }
                      if (condition.hasOwnProperty('to_weight') && match) {
                          if (!variant.hasOwnProperty('weight') || variant.weight === 0 || variant.weight > condition.to_weight) {
                              match = false;
                          }
                      }
                  }
              }

              // Variants
              var includeVariants;
              if (condition.variant_apply === 'matching_and_variants') {
                  if (!match) {
                      includeVariants = condition.include_variants.split(",");
                      if (jQuery.inArray(variant.id + "", includeVariants) >= 0) {
                          match = true;
                      }
                  } else {
                      var exceptVariants = condition.exclude_variants.split(",");
                      if (jQuery.inArray(variant.id + "", exceptVariants) >= 0) {
                          match = false;
                      }
                  }
              } else if (condition.variant_apply === 'variants') {
                  match = false;
                  includeVariants = condition.include_variants.split(",");
                  if (jQuery.inArray(variant.id + "", includeVariants) >= 0) {
                      match = true;
                  }
              } else if (condition.variant_apply === 'select_all') {
                  match = true;
              }

          if (condition.starts_at || condition.ends_at) {
              if (match) {
                  // Scheduled
                  if (condition.starts_at) {
                      if (Date.now() < Date.parse(condition.starts_at)){
                          match = false;
                      }
                  }
                  if (condition.ends_at && match) {
                      if (Date.now() > Date.parse(condition.ends_at)){
                          match = false;
                      }
                  }
              }
          }

          if (match) {
              match_count++;
          } else {
              continue;
          }

              var newNode = document.createElement("div");
              newNode.setAttribute("data-label-id", label.id);
              newNode.classList.add("pl-image");
              newNode.classList.add("pl-animation");
              if (label.customize_position === 0) {
                newNode.classList.add(label.position);
              }
              newNode.style.width = (label.label_width >= 0 ? label.label_width : 30) + (label.fixed_size ? 'px' : '%');
              if (label.customize_position === 1) {
                newNode.style.top = label.top + '%';
                newNode.style.left = label.left + '%';
              }
              newNode.style.margin = label.margin.top + 'px ' + label.margin.right + 'px ' + label.margin.bottom + 'px ' + label.margin.left + 'px';
              newNode.style.transform = 'rotate(' + label.rotate + 'deg)';
              newNode.style.opacity = label.opacity;
              newNode.style.animationName = label.animation;
              if (label.label_type === 0) {
                newNode.style.height = 'fit-content';
                newNode.style.cssText += label.styles;
                var imageLabel = document.createElement('img');
                imageLabel.classList.add("pl-w-100");
                imageLabel.setAttribute("src", label.image);
                newNode.appendChild(imageLabel);
              } else {
                if (label.image.length === 0) {
                  if (design.shape_class) {
                    newNode.classList.add(design.shape_class);
                  }
                  newNode.style.backgroundColor = design.shape_color  ;
                  newNode.style.height = (label.label_height >= 0 ? label.label_height : 30) + (label.fixed_size ? 'px' : '%');

                  } else {
                    newNode.style.height = 'fit-content';
                    var imageLabel = document.createElement('img');
                    imageLabel.classList.add("pl-w-100");
                    imageLabel.setAttribute("src", label.image);
                    if (label.alt?.length) {
                        imageLabel.setAttribute("alt", label.alt);
                    } else {
                        imageLabel.setAttribute("alt", "Deco product label");
                    }
                    if (label.alt?.length) {
                        imageLabel.setAttribute("alt", label.alt);
                    } else {
                        imageLabel.setAttribute("alt", "Deco product label");
                    }
                    newNode.appendChild(imageLabel);
                  }
                    if (design.border) {
                        newNode.style.border = design.border.style + ' ' + design.border.size + 'px ' + design.border.color;
                    }
                    if (design.border_radius) {
                        newNode.style.borderRadius = design.border_radius + 'px'
                    }
                    newNode.style.cssText += label.styles;
                }

              if (label.text && label.label_type === 1) {
                  var text = SECOMAPP.decode(label.text);
                  if (text.indexOf("{SAVE_PERCENT}") >= 0) {
                      var save_percent = 0;
                      if (variant.hasOwnProperty('compare_at_price') && variant.price < variant.compare_at_price) {
                          save_percent = (variant.compare_at_price - variant.price) * 100 / variant.compare_at_price;
                          save_percent = Math.round(save_percent);
                      }
                      text = text.replace('{SAVE_PERCENT}', save_percent);
                  }
                  if (text.indexOf("{MAX_SALE}") >= 0) {
                      var max_percent = 0;
                      for (i = 0; i < product.variants.length; i++) {
                          if (product.variants[i].hasOwnProperty('compare_at_price') && product.variants[i].price < product.variants[i].compare_at_price) {
                              save_percent = (product.variants[i].compare_at_price - product.variants[i].price) * 100 / product.variants[i].compare_at_price;
                              save_percent = Math.round(save_percent);
                              if (save_percent > max_percent) {
                                  max_percent = save_percent;
                              }
                          }
                      }
                      text = text.replace('{MAX_SALE}', max_percent);
                  }
                  if (text.indexOf("{MIN_SALE}") >= 0) {
                      var min_percent = 100;
                      for (var i = 0; i < product.variants.length; i++) {
                          if (product.variants[i].hasOwnProperty('compare_at_price') && product.variants[i].price < product.variants[i].compare_at_price) {
                              save_percent = (product.variants[i].compare_at_price - product.variants[i].price) * 100 / product.variants[i].compare_at_price;
                              save_percent = Math.round(save_percent);
                              if (save_percent < min_percent) {
                                  min_percent = save_percent;
                              }
                          }
                      }
                      text = text.replace('{MIN_SALE}', min_percent);
                  }
                  if (text.indexOf("{SAVE_AMOUNT}") >= 0) {
                      var save_amount = 0;
                      if (variant.hasOwnProperty('compare_at_price') && variant.price < variant.compare_at_price) {
                          save_amount = variant.compare_at_price - variant.price;
                      }
                      if (save_amount % 100 === 0) {
                          text = text.replace('{SAVE_AMOUNT}', (save_amount / 100));
                      } else if (save_amount % 10 === 0) {
                          text = text.replace('{SAVE_AMOUNT}', (save_amount / 100).toFixed(1));
                      } else {
                          text = text.replace('{SAVE_AMOUNT}', (save_amount / 100).toFixed(2));
                      }
                  }
                  if (text.indexOf("{PRICE}") >= 0) {
                      text = text.replace('{PRICE}', (variant.price / 100).toFixed(2));
                  }
                  if (text.indexOf("{MIN_PRICE}") >= 0) {
                      text = text.replace('{MIN_PRICE}', (product.price / 100).toFixed(2));
                  }
                  if (text.indexOf("{MAX_PRICE}") >= 0) {
                      var max_price = 0;
                      for (i = 0; i < product.variants.length; i++) {
                          if (product.variants[i].price > max_price) {
                              max_price = product.variants[i].price;
                          }
                      }
                      text = text.replace('{MAX_PRICE}', (max_price / 100).toFixed(2));
                  }
                  if (text.indexOf("{NEW_FOR}") >= 0) {
                      var date_difference = (new Date() - Date.parse(product.published_at)) / 86400000;
                      date_difference = date_difference < 0 ? 0 : Math.ceil(date_difference);
                      text = text.replace('{NEW_FOR}', date_difference);
                  }
                  if (text.indexOf("{SKU}") >= 0) {
                      sku = variant.sku ? variant.sku : '';
                      text = text.replace('{SKU}', sku);
                  }
                  if (text.indexOf("{STOCK}") >= 0) {
                      var stock = variant.inventory_quantity >= 0 ? variant.inventory_quantity : 0;
                      text = text.replace('{STOCK}', stock);
                  }
                  var font_size;
                  if (design.font_size_ratio !== 0) {
                      var image = getProductImage();
                      if (label.fixed_size) {
                          font_size = Math.sqrt(label.label_height/design.font_size_ratio);
                      } else {
                          font_size = Math.sqrt((image.get(0).height * label.label_height /100)/ design.font_size_ratio);
                      }
                  }
                  font_size = font_size ? font_size : design.font_size;
                  var textElement = document.createElement("span");
                  textElement.classList.add("pl-text");
                  textElement.style.color = design.text_color ? design.text_color : '';
                  textElement.style.fontSize = design.font_size ? (design.font_size_ratio === 0 ? design.font_size : font_size) + 'px' : '';
                  if (design.font_style) {
                  textElement.style.fontWeight = design.font_style.weight;
                  textElement.style.fontStyle = design.font_style.style;
                  textElement.style.textDecoration = design.font_style.decoration;
                  }
                  textElement.style.letterSpacing = design.letter_spacing ? design.letter_spacing + 'px' : '';
                  textElement.style.cssText += label.text_styles;
                  textElement.style.wordBreak = 'break-word';
                  textElement.innerHTML += text;
                  newNode.appendChild(textElement);
              }
            if (label.link?.length > 0) {
                newNode.addEventListener("click", function(){ window.open(label.link, '_blank'); });
            }
            if (label.tooltip?.length > 0) {
                var tooltipElement = document.createElement("span");
                tooltipElement.classList.add("pl-tooltip");
                var tooltipText = SECOMAPP.decode(label.tooltip)
                tooltipElement.innerHTML = tooltipText;
                newNode.appendChild(tooltipElement);
            }
              if (group_ids.length) {
                var in_group = false;
                for (var g = 0; g < label_groups.length; g++) {
                    var group = label_groups[g];
                    if (group) {
                        var groupNode = document.querySelector('.pl-container.pl-product .pl-group[data-group-id="'+ group.id +'"]');
                        if (groupNode) {
                          if (groupNode.querySelector('.pl-image[data-label-id="'+ label.id +'"]')) {
                            continue;
                          } else {
                            if (label.customize_position === 0) {
                                newNode.classList.remove(label.position);
                            }
                            groupNode.appendChild(newNode);
                          }
                        } else {
                          var newGroupNode = document.createElement('div');
                          newGroupNode.classList.add('pl-group');
                          newGroupNode.classList.add(group.direction);
                          newGroupNode.classList.add(group.position);
                          newGroupNode.setAttribute('data-group-id', group.id);
                          newGroupNode.style.gap = group.gap + 'px';
                          var position_unit = group.position_unit_type === 'fixed' ? 'px' : '%';
                          var vertical = group.position.split('_')[1];
                          if (vertical == 'top') {
                            newGroupNode.style.top = group.vertical + position_unit;
                          } else if (vertical == 'bottom') {
                            newGroupNode.style.bottom = group.vertical + position_unit;
                          }
                            var horizontal = group.position.split('_')[2];
                            if (horizontal == 'left') {
                                newGroupNode.style.left = group.horizontal + position_unit;
                            } else if (horizontal == 'right') {
                                newGroupNode.style.right = group.horizontal + position_unit;
                            }
                          newGroupNode.style.cssText += group.styles;
                            if (label.customize_position === 0) {
                                newNode.classList.remove(label.position);
                            }
                          newGroupNode.appendChild(newNode);
                          document.querySelector('.pl-container.pl-product')?.appendChild(newGroupNode);
                        }
                        in_group = true;
                    }
                }
                if (!in_group) {
                    document.querySelector('.pl-container.pl-product')?.appendChild(newNode);
                }
              } else {
                  document.querySelector('.pl-container.pl-product')?.appendChild(newNode);
              }

            for (var g = 0; g < label_groups.length; g++) {
                var group = label_groups[g];
                if (group) {
                    var groupNode = document.querySelector('.pl-product .pl-group[data-group-id="'+ group.id +'"]');
                    var label_ids = group.label_ids.split(',').map(Number);
                    for (var k = 0; k < label_ids.length; k++) {
                        var label = groupNode?.querySelector('.pl-image[data-label-id="'+ label_ids[k] +'"]');
                        if (label) {
                            var newNode = label;
                            label.remove();
                            groupNode.appendChild(newNode);
                        }
                    }
                }
            }
        }
    };

    //get matched label
    SECOMAPP.pl.showCollectionLabels = function (product, element) {
        var firstVariantId = product.hasOwnProperty('selected_or_first_available_variant_id') ?
            product.selected_or_first_available_variant_id : 0;
        var firstVariant = null;
        if (firstVariantId) {
            for (i = 0; i < product.variants.length; i++) {
                if (product.variants[i].id === firstVariantId) {
                    firstVariant = product.variants[i];
                    break;
                }
            }
        }
        var collectionNode;

        if ((typeof SECOMAPP.pl.lpsPath) == 'undefined') {
          collectionNode = jQuery('.pl-container', element);
        } else {
            if (jQuery(element).parents('.pl-parent').length === 0) {
               collectionNode = jQuery('.pl-container', element);
            } else {
               collectionNode = jQuery('.pl-container', jQuery(element).parents('.pl-parent').first());
            }
        }

        if (collectionNode.length === 0) {
            return;
        }

        var labels = SECOMAPP.pl.labels;
        var groups = SECOMAPP.pl.groups;
        var match_count = 0;
          for (var j = 0; j < labels.length; j++) {
              var label = labels[j];
              if (label.page.indexOf(SECOMAPP.page) === -1) {
                  continue;
              }

              var condition = label.conditions;
              var design = label.design;
              var group_ids = label.group_ids.split(',').map(Number);
              var match = true;

              // Hide if label with higher priority is already applied
              if (label.hide) {
                  if (match_count > 0) {
                      continue;
                  }
              }

        var label_groups = groups.map((group) => {
            if (group_ids.includes(group.id)) {
                return group;
            }
        });

        if (collectionNode[0].querySelector('.pl-image[data-label-id="'+ label.id +'"]')) {
            match_count++;
            continue;
        }

        var compare_at_price_threshold;
            if (condition.is_on_sale === 'yes') {
                if (match) {
                    // Is On Sale
                    if (!product.hasOwnProperty('compare_at_price') || product.compare_at_price == null) {
                        match = false;
                    } else if (product.price < product.compare_at_price) {
                        var sale = product.compare_at_price - product.price;

                        if (condition.discount_by === 'percentage') {
                            sale = sale / product.compare_at_price * 100;
                        }

                        if (condition.discount_by === 'amount') {
                            sale = sale / 100;
                        }

                        if (condition.discount_type === 'fixed') {
                            if (sale !== condition.discount_fixed) {
                                match = false;
                            }
                        } else if (condition.discount_type === 'range') {
                            if (condition.discount_from && condition.discount_to) {
                                if (sale < condition.discount_from || sale > condition.discount_to) {
                                    match = false;
                                }
                            } else if (condition.discount_from) {
                                if (sale < condition.discount_from) {
                                    match = false;
                                }
                            } else if (condition.discount_to) {
                                if (sale > condition.discount_to) {
                                    match = false;
                                }
                            }
                        }
                    } else {
                        match = false;
                    }
                }
            } else if (condition.is_on_sale === 'no') {
                if (match) {
                    if (product.hasOwnProperty('compare_at_price')) {
                        if (product.price < product.compare_at_price) {
                            match = false;
                        }
                    }
                }
            }

            // Is New
            var published_arr = product.published_at.split(" ");
            var published_at = published_arr[0] + ' ' + published_arr[1];
            if (condition.is_new === 'yes') {
                // Last X Days
                if (match) {
                    if ((new Date() - Date.parse(published_at)) / 86400000 > condition.new_days_threshold) {
                        match = false;
                    }
                }
            } else if (condition.is_new === 'no') {
                // Last X Days
                if (match) {
                    if ((new Date() - Date.parse(published_at)) / 86400000 <= condition.new_days_threshold) {
                        match = false;
                    }
                }
            } else if (condition.is_new === 'date_range') {
                if (match) {
                    if (condition.new_date_from && condition.new_date_to) {
                        if (Date.parse(published_at) < Date.parse(condition.new_date_from) || Date.parse(published_at) > Date.parse(condition.new_date_to)) {
                            match = false;
                        }
                    } else if (condition.new_date_from) {
                        if (Date.parse(published_at) < Date.parse(condition.new_date_from)) {
                            match = false;
                        }
                    } else if (condition.new_date_to) {
                        if (Date.parse(published_at) > Date.parse(condition.new_date_to)) {
                            match = false;
                        }
                    }
                }
            }

              // Collections
              if (condition.collections) {
                  var collections = condition.collections.split(',').map(x => +x)
                  if (match) {
                      match = false;
                      for (i = 0; i < product.collections.length; i++) {
                          var cId = product.collections[i];
                          if (collections.indexOf(cId) >= 0) {
                              match = true;
                              break;
                          }
                      }
                  }
              }

              // Exclude Collections
              if (condition.exclude_collections) {
                  var exclude_collections = condition.exclude_collections.split(',').map(x => +x)
                  if (match) {
                      for (i = 0; i < product.collections.length; i++) {
                          cId = product.collections[i];
                          if (exclude_collections.indexOf(cId) >= 0) {
                              match = false;
                              break;
                          }
                      }
                  }
              }

              // Tags
              if (condition.tags) {
                  var tags = condition.tags.split(',')
                  if (match) {
                      match = false;
                      if (product.hasOwnProperty('tags')) {
                          for (i = 0; i < product.tags.length; i++) {
                              if (tags.indexOf(product.tags[i]) >= 0) {
                                  match = true;
                                  break;
                              }
                          }
                      }
                  }
              }

              // Exclude Tags
              if (condition.exclude_tags) {
                  var exclude_tags = condition.exclude_tags.split(',')
                  if (match) {
                      if (product.hasOwnProperty('tags')) {
                          for (i = 0; i < product.tags.length; i++) {
                              if (exclude_tags.indexOf(product.tags[i]) >= 0) {
                                  match = false;
                                  break;
                              }
                          }
                      }
                  }
              }

            // Stock
            var variant;
            if (condition.stock_status === 'in_stock') {
                if (match) {
                    // in stock
                    match = false;
                    for (i = 0; i < product.variants.length; i++) {
                        variant = product.variants[i];
                        if (variant.inventory_quantity > 0 || !variant.hasOwnProperty('inventory_management')) {
                            match = true;
                            break;
                        }
                    }
                }
            } else if (condition.stock_status === 'out_of_stock') {
                if (match) {
                    // out of stock
                    for (i = 0; i < product.variants.length; i++) {
                        variant = product.variants[i];
                        if (variant.inventory_quantity > 0 || !variant.hasOwnProperty('inventory_management')) {
                            match = false;
                            break;
                        }
                    }
                }
            } else if (condition.stock_status === 'low_stock') {
                if (match) {
                    // low stock (at least 1 variant low stock)
                    match = false;
                    if (condition.product_stock_computation == 'per_variant') {
                        for (i = 0; i < product.variants.length; i++) {
                            variant = product.variants[i];
                            if (variant.inventory_quantity > 0 && variant.inventory_quantity <= condition.low_stock_threshold && variant.hasOwnProperty('inventory_management')) {
                                match = true;
                                break;
                            }
                        }
                    } else {
                        product_inventory_quantity = 0;
                        for (i = 0; i < product.variants.length; i++) {
                            variant = product.variants[i];
                            if (!variant.hasOwnProperty('inventory_management')) {
                                product_inventory_quantity = -1;
                                break; // not low stock
                            } else {
                                if (variant.inventory_quantity >= 0) {
                                    product_inventory_quantity += variant.inventory_quantity;
                                }
                            }
                        }
                        if (product_inventory_quantity > 0 && product_inventory_quantity <= condition.low_stock_threshold) {
                            match = true;
                        }
                    }
                }
            } else if (condition.stock_status === 'stock_range') {
                if (match) {
                // stock range
                    match = false;
                    if (condition.product_stock_computation == 'per_variant') {
                        for (i = 0; i < product.variants.length; i++) {
                            variant = product.variants[i];
                            if (variant.inventory_quantity >= condition.stock_from && variant.inventory_quantity <= condition.stock_to && variant.hasOwnProperty('inventory_management')) {
                                match = true;
                                break;
                            }
                        }
                    } else {
                        product_inventory_quantity = 0;
                        for (i = 0; i < product.variants.length; i++) {
                            variant = product.variants[i];
                            if (!variant.hasOwnProperty('inventory_management')) {
                                product_inventory_quantity = -1;
                                break; // not low stock
                            } else {
                                if (variant.inventory_quantity >= 0) {
                                    product_inventory_quantity += variant.inventory_quantity;
                                }
                            }
                        }
                        if (condition.stock_from && condition.stock_to) {
                            if (product_inventory_quantity >= condition.stock_from && product_inventory_quantity <= condition.stock_to) {
                                match = true;
                            }
                        } else if (condition.stock_from) {
                            if (product_inventory_quantity >= condition.stock_from) {
                                match = true;
                            }
                        } else if (condition.stock_to) {
                            if (product_inventory_quantity <= condition.stock_to) {
                                match = true;
                            }
                        }
                    }
                }
            }

              // Price Range
              if (condition.hasOwnProperty('from_price') || condition.hasOwnProperty('to_price')) {
                  if (match) {
                      if (condition.hasOwnProperty('from_price')) {
                          if (product.price < condition.from_price * 100) {
                              match = false;
                          }
                      }
                      if (condition.hasOwnProperty('to_price') && match) {
                          if (match === true && product.price > condition.to_price * 100) {
                              match = false;
                          }
                      }
                  }
              }

              // Weight Range
              if (condition.hasOwnProperty('from_weight') || condition.hasOwnProperty('to_weight')) {
                  if (match) {
                      // check if any variant match
                      match = false;
                      for (i = 0; i < product.variants.length; i++) {
                          variant = product.variants[i];
                          match = true;
                          if (condition.hasOwnProperty('from_weight')) {
                              if (!variant.hasOwnProperty('weight') || variant.weight === 0 || variant.weight < condition.from_weight) {
                                  match = false;
                              }
                          }
                          if (condition.hasOwnProperty('to_weight') && match) {
                              if (!variant.hasOwnProperty('weight') || variant.weight === 0 || variant.weight > condition.to_weight) {
                                  match = false;
                              }
                          }
                          if (match) break;
                      }
                  }
              }

              // Variants
              if (condition.variant_apply === 'matching_and_variants') {
                  if (!match) {
                      var includeVariants = condition.include_variants.split(",");
                      for (i = 0; i < product.variants.length; i++) {
                          variant = product.variants[i];
                          if (jQuery.inArray(variant.id + "", includeVariants) >= 0) {
                              match = true;
                              break;
                          }
                      }
                  } else {
                      var exceptVariants = condition.exclude_variants.split(",");
                      for (i = 0; i < product.variants.length; i++) {
                          variant = product.variants[i];
                          if (jQuery.inArray(variant.id + "", exceptVariants) >= 0) {
                              match = false;
                              break;
                          }
                      }
                  }
              } else if (condition.variant_apply === 'variants') {
                  match = false;
                  includeVariants = condition.include_variants.split(",");
                  for (i = 0; i < product.variants.length; i++) {
                      variant = product.variants[i];
                      if (jQuery.inArray(variant.id + "", includeVariants) >= 0) {
                          match = true;
                          break;
                      }
                  }
              } else if (condition.variant_apply === 'select_all') {
                  match = true;
              }

              if (condition.starts_at || condition.ends_at) {
                  if (match) {
                      // Scheduled
                      if (condition.starts_at) {
                          if (Date.now() < Date.parse(condition.starts_at)) {
                              match = false;
                          }
                      }
                      if (condition.ends_at && match) {
                          if (Date.now() > Date.parse(condition.ends_at)) {
                              match = false;
                          }
                      }
                  }
              }

              if (match) {
                  match_count++;
              } else {
                  continue;
              }

              // show label or create new
                  var newNode = document.createElement("div");
                  newNode.setAttribute("data-label-id", label.id);
                  newNode.classList.add("pl-image");
                  newNode.classList.add("pl-animation");
                  if (label.customize_position === 0) {
                    newNode.classList.add(label.position);
                  }
                  newNode.style.width = (label.label_width >= 0 ? label.label_width : 30) + (label.fixed_size ? 'px' : '%');
                  if (label.customize_position === 1) {
                      newNode.style.top = label.top + '%';
                      newNode.style.left = label.left + '%';
                  }
                  newNode.style.margin = label.margin.top + 'px ' + label.margin.right + 'px ' + label.margin.bottom + 'px ' + label.margin.left + 'px';
                  newNode.style.transform = 'rotate('+ label.rotate +'deg)';
                  newNode.style.opacity = label.opacity;
                  newNode.style.animationName = label.animation;
                  if (label.label_type === 0) {
                      newNode.style.height = 'fit-content';
                      newNode.style.cssText += label.styles;
                      var imageLabel = document.createElement('img');
                      imageLabel.classList.add("pl-w-100");
                      imageLabel.setAttribute("src", label.image);
                    if (label.alt?.length) {
                        imageLabel.setAttribute("alt", label.alt);
                    } else {
                        imageLabel.setAttribute("alt", product.handle);
                    }
                      newNode.appendChild(imageLabel);
                  } else {
                      if (label.image.length === 0) {
                          if (design.shape_class) {
                              newNode.classList.add(design.shape_class);
                          }
                          newNode.style.backgroundColor = design.shape_color;
                          newNode.style.height = (label.label_height >= 0 ? label.label_height : 30) + (label.fixed_size ? 'px' : '%');

                      } else {
                          newNode.style.height = 'fit-content';
                          var imageLabel = document.createElement('img');
                          imageLabel.classList.add("pl-w-100");
                          imageLabel.setAttribute("src", label.image);
                        if (label.alt?.length) {
                            imageLabel.setAttribute("alt", label.alt);
                        } else {
                            imageLabel.setAttribute("alt", product.handle);
                        }
                          newNode.appendChild(imageLabel);
                      }
                      if (design.border) {
                          newNode.style.border = design.border.style + ' ' + design.border.size + 'px ' + design.border.color;
                      }
                      if (design.border_radius) {
                          newNode.style.borderRadius = design.border_radius + 'px'
                      }
                      newNode.style.cssText += label.styles;
                  }

                  if (label.text && label.label_type === 1) {
                    var text = SECOMAPP.decode(label.text);
                    if (text.indexOf("{SAVE_PERCENT}") >= 0) {
                        var save_percent = 0;
                        if (firstVariant) {
                            if (firstVariant.hasOwnProperty('compare_at_price') && firstVariant.price < firstVariant.compare_at_price) {
                                save_percent = (firstVariant.compare_at_price - firstVariant.price) * 100 / firstVariant.compare_at_price;
                                save_percent = Math.round(save_percent);
                            }
                        } else {
                            if (product.hasOwnProperty('compare_at_price') && product.price < product.compare_at_price) {
                                save_percent = (product.compare_at_price - product.price) * 100 / product.compare_at_price;
                                save_percent = Math.round(save_percent);
                            }
                        }
                        text = text.replace('{SAVE_PERCENT}', save_percent);
                    }
                    if (text.indexOf("{MAX_SALE}") >= 0) {
                        var max_percent = 0;
                        for (i = 0; i < product.variants.length; i++) {
                            if (product.variants[i].hasOwnProperty('compare_at_price') && product.variants[i].price < product.variants[i].compare_at_price) {
                                save_percent = (product.variants[i].compare_at_price - product.variants[i].price) * 100 / product.variants[i].compare_at_price;
                                save_percent = Math.round(save_percent);
                                if (save_percent > max_percent) {
                                    max_percent = save_percent;
                                }
                            }
                        }
                        text = text.replace('{MAX_SALE}', max_percent);
                    }
                    if (text.indexOf("{MIN_SALE}") >= 0) {
                        var min_percent = 100;
                        for (i = 0; i < product.variants.length; i++) {
                            if (product.variants[i].hasOwnProperty('compare_at_price') && product.variants[i].price < product.variants[i].compare_at_price) {
                                save_percent = (product.variants[i].compare_at_price - product.variants[i].price) * 100 / product.variants[i].compare_at_price;
                                save_percent = Math.round(save_percent);
                                if (save_percent < max_percent) {
                                    min_percent = save_percent;
                                }
                            }
                        }
                        text = text.replace('{MIN_SALE}', min_percent);
                    }
                    if (text.indexOf("{SAVE_AMOUNT}") >= 0) {
                        var save_amount = 0;
                        if (firstVariant) {
                            if (firstVariant.hasOwnProperty('compare_at_price') && firstVariant.price < firstVariant.compare_at_price) {
                                save_amount = firstVariant.compare_at_price - firstVariant.price;
                            }
                        } else {
                            if (product.hasOwnProperty('compare_at_price') && product.price < product.compare_at_price) {
                                save_amount = product.compare_at_price - product.price;
                            }
                        }

                        if (save_amount % 100 === 0) {
                            text = text.replace('{SAVE_AMOUNT}', (save_amount / 100));
                        } else if (save_amount % 10 === 0) {
                            text = text.replace('{SAVE_AMOUNT}', (save_amount / 100).toFixed(1));
                        } else {
                            text = text.replace('{SAVE_AMOUNT}', (save_amount / 100).toFixed(2));
                        }
                    }
                    if (text.indexOf("{PRICE}") >= 0) {
                        if (firstVariant) {
                            text = text.replace('{PRICE}', (firstVariant.price / 100).toFixed(2));
                        } else {
                            text = text.replace('{PRICE}', (product.price / 100).toFixed(2));
                        }
                    }
                    if (text.indexOf("{MIN_PRICE}") >= 0) {
                        text = text.replace('{MIN_PRICE}', (product.price / 100).toFixed(2));
                    }
                    if (text.indexOf("{MAX_PRICE}") >= 0) {
                        var max_price = 0;
                        for (var i = 0; i < product.variants.length; i++) {
                            if (product.variants[i].price > max_price) {
                                max_price = product.variants[i].price;
                            }
                        }
                        text = text.replace('{MAX_PRICE}', (max_price / 100).toFixed(2));
                    }
                    if (text.indexOf("{NEW_FOR}") >= 0) {
                        var date_difference = (new Date() - Date.parse(product.published_at)) / 86400000;
                        date_difference = date_difference < 0 ? 0 : Math.ceil(date_difference);
                        text = text.replace('{NEW_FOR}', date_difference);
                    }
                    if (text.indexOf("{STOCK}") >= 0) {
                        var product_inventory_quantity = 0;
                        for (i = 0; i < product.variants.length; i++) {
                            variant = product.variants[i];
                            if (!variant.hasOwnProperty('inventory_management')) {

                            } else {
                                if (variant.inventory_quantity >= 0) {
                                    product_inventory_quantity += variant.inventory_quantity;
                                }
                            }
                        }
                        text = text.replace('{STOCK}', product_inventory_quantity);
                    }
                    var font_size;
                    if (design.font_size_ratio !== 0 && element.get(0) !== undefined) {
                      if (label.fixed_size) {
                        font_size = Math.sqrt(label.label_height/design.font_size_ratio) - 3;
                      } else {
                        font_size = Math.sqrt((element.get(0).offsetHeight * label.label_height /100)/ design.font_size_ratio) - 3;
                      }
                    }
                    font_size = font_size ? font_size : design.font_size;
                    var textElement = document.createElement("span");
                    textElement.classList.add("pl-text");
                    textElement.style.color = design.text_color ? design.text_color : '';
                    textElement.style.fontSize = design.font_size ? (design.font_size_ratio === 0 ? design.font_size : font_size) + 'px' : '';
                    if (design.font_style) {
                        textElement.style.fontWeight = design.font_style.weight;
                        textElement.style.fontStyle = design.font_style.style;
                        textElement.style.textDecoration = design.font_style.decoration;
                    }
                    textElement.style.letterSpacing = design.letter_spacing ? design.letter_spacing + 'px' : '';
                    textElement.style.cssText += label.text_styles;
                    textElement.style.wordBreak = 'break-word';
                    textElement.innerHTML += text;
                    newNode.appendChild(textElement);
                  }
                if (label.link?.length > 0) {
                    newNode.addEventListener("click", function(){ window.open(label.link, '_blank'); });
                }
                if (label.tooltip?.length > 0) {
                    var tooltipElement = document.createElement("span");
                    tooltipElement.classList.add("pl-tooltip");
                    var tooltipText = SECOMAPP.decode(label.tooltip);
                    tooltipElement.innerHTML = tooltipText;
                    newNode.appendChild(tooltipElement);

                }
                if (group_ids.length) {
                    var in_group = false;
                    for (var g = 0; g < label_groups.length; g++) {
                        var group = label_groups[g];
                        if (group) {
                            var groupNode = collectionNode[0].querySelector('.pl-group[data-group-id="'+ group.id +'"]');
                            if (groupNode) {
                                if (groupNode.querySelector('.pl-image[data-label-id="'+ label.id +'"]')) {
                                    continue;
                                } else {
                                    var nodeTmp = newNode.cloneNode(true);
                                    if (label.customize_position === 0) {
                                        nodeTmp.classList.remove(label.position);
                                    }
                                    groupNode.appendChild(nodeTmp);
                                }
                            } else {
                                var newGroupNode = document.createElement('div');
                                newGroupNode.classList.add('pl-group');
                                newGroupNode.classList.add(group.direction);
                                newGroupNode.classList.add(group.position);
                                newGroupNode.setAttribute('data-group-id', group.id)
                                newGroupNode.style.gap = group.gap + 'px';
                                var position_unit = group.position_unit_type === 'fixed' ? 'px' : '%';
                                var vertical = group.position.split('_')[1];
                                if (vertical == 'top') {
                                    newGroupNode.style.top = group.vertical + position_unit;
                                } else if (vertical == 'bottom') {
                                    newGroupNode.style.bottom = group.vertical + position_unit;
                                }
                                var horizontal = group.position.split('_')[2];
                                if (horizontal == 'left') {
                                    newGroupNode.style.left = group.horizontal + position_unit;
                                } else if (horizontal == 'right') {
                                    newGroupNode.style.right = group.horizontal + position_unit;
                                }
                                newGroupNode.style.cssText += group.styles;
                                var nodeTmp = newNode.cloneNode(true);
                                if (label.customize_position === 0) {
                                    nodeTmp.classList.remove(label.position);
                                }
                                newGroupNode.appendChild(nodeTmp);
                                collectionNode.append(newGroupNode);
                            }
                            in_group = true;
                        }
                    }
                    if (!in_group) {
                        collectionNode.append(newNode);
                    }
                } else {
                    collectionNode.append(newNode);
                }
        }
        if (collectionNode.length) {
            for (var g = 0; g < label_groups.length; g++) {
                var group = label_groups[g];
                if (group) {
                    var groupNode = collectionNode[0].querySelector('.pl-group[data-group-id="'+ group.id +'"]');
                    var label_ids = group.label_ids.split(',').map(Number);
                    for (var k = 0; k < label_ids.length; k++) {
                    var label = groupNode?.querySelector('.pl-image[data-label-id="'+ label_ids[k] +'"]');
                        if (label) {
                            var newNode = label;
                            label.remove();
                            groupNode.appendChild(newNode);
                        }
                    }
                }
            }
        }
        return null;
    };

    function getProductImages() {
        var productImages =
            (typeof SECOMAPP.pl.pisRegex) == 'undefined' ?
                jQuery('a[href*="/products/"]:not([href*=".jp"]):not(form a[href*="/products/"]):not(.related-products a[href*="/products/"]):not(.not-sca-pl a[href*="/products/"]):not([href*=".JP"]):not([href*=".png"]):not([href*=".PNG"])').has('img[src*="/products/"]:not([class*="not-sca-pl"]), img[src*="/no-image"], img[data-src*="/products/"]:not([class*="not-sca-pl"]), img[data-src*="/no-image"]')
                :
                jQuery(SECOMAPP.pl.pisRegex)
        ;

        var products = {};
        productImages.each(function (index, product) {
            if (!(jQuery(product).attr('href')) && !(jQuery(product).attr('data-href'))) {
                return;
            }
            var splits = jQuery(product).attr('href');
            if(! splits){
                splits = jQuery(product).attr('data-href');
                splits = splits.split('/');
            }else{
                splits = splits.split('/');
            }
            var handle = splits[splits.length - 1].split(/[?#]/)[0];
            if (products.hasOwnProperty(handle)) {
                handles = products[handle];
                if (!(handles instanceof Array)) {
                    handles = [handles];
                    products[handle] = handles;
                }
                handles.push(product);
            } else {
                products[handle] = product;
            }
            // fix for handle has special char
            var handle2 = decodeURI(handle);
            if (handle !== handle2) {
                if (products.hasOwnProperty(handle2)) {
                    var handles = products[handle2];
                    if (!(handles instanceof Array)) {
                        handles = [handles];
                        products[handle2] = handles;
                    }
                    handles.push(product);
                } else {
                    products[handle2] = product;
                }
            }
        });
        return products;
    }

    function getProductImage() {
        // old
        // var image = jQuery('.pl-product ~ img').first();
        var images;
        if ((typeof SECOMAPP.pl.piRegex) == 'undefined') {
            images = jQuery('img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".jp"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".JP"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".png"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".PNG"]');
        } else {
            images = jQuery(SECOMAPP.pl.piRegex);
            if ((typeof images) === 'undefined' || images.length === 0) {
                if (typeof SECOMAPP.pl.retry === 'undefined') {
                    SECOMAPP.pl.retry = 1;
                } else {
                    SECOMAPP.pl.retry = SECOMAPP.pl.retry + 1;
                }
                if (SECOMAPP.pl.retry < 5) {
                    setTimeout(function () {
                        SECOMAPP.pl.labelProduct();
                    }, 1000);
                }
            }
        }
        // fix the biggest image
        var maxWidth = 0;
        var mainImage;
        var title = jQuery("meta[property='og:title']").attr("content");
        if ((typeof SECOMAPP.pl.piRegex) != 'undefined' && images.length === 1) {
            mainImage = images.first();
        } else {
            images.each(function (index, image) {
                if (jQuery(image).css('opacity') === "0" || jQuery(image).css('visibility') === "hidden" || jQuery(image).css('display') === "none") {
                    return;
                }
                var currentWidth = jQuery(image).width();
                if (title) {
                    var alt = jQuery(image).attr('alt');
                    if (alt) {
                        if (alt.indexOf(title) >= 0) {
                            currentWidth *= 2;
                        }
                    }
                }
                if (currentWidth > maxWidth) {
                    maxWidth = currentWidth;
                    mainImage = image;
                }
            });
        }
        if (mainImage === undefined && images.length > 0) {
            images.each(function (index, image) {
                if (jQuery(image).css('opacity') === "0" || jQuery(image).css('visibility') === "hidden" || jQuery(image).css('display') === "none") {
                    return;
                }
                var currentWidth = image.width;
                if (currentWidth > maxWidth) {
                    maxWidth = currentWidth;
                    mainImage = image;
                }
            });
        }
        if (mainImage === undefined && images.length > 0) mainImage = images.first();
        return jQuery(mainImage);
    }

    function getVariantId() {
        var variantId = SECOMAPP.isDefined(Shopify.urlParam) ? Shopify.urlParam("variant") : false;
        if (!variantId) {
            variantId = location.search.split('variant=')[1]
        }
        if (!variantId) {
            var elem = SECOMAPP.isDefined(Shopify.OptionSelectors) ? document.getElementById(Shopify.OptionSelectors.domIdPrefix) : false;
            if (!elem) {
                return false;
            }
            var option = elem.querySelector("[selected]");

            if (!option) {
                return false;
            }

            variantId = option.value;
        }

        return variantId;
    }

    function showLabelImage(productImage, handle) {
        var images;
        if ((typeof SECOMAPP.pl.pi2sRegex) !== 'undefined') {
            if (SECOMAPP.pl.pi2sParent) {
                var pi2sParent = jQuery(productImage).parents(SECOMAPP.pl.pi2sParent).first();
                if (pi2sParent.length) {
                    images = jQuery(SECOMAPP.pl.pi2sRegex, pi2sParent);
                } else {
                    images = jQuery(SECOMAPP.pl.pi2sRegex, productImage);
                }
            } else {
                images = jQuery(SECOMAPP.pl.pi2sRegex, productImage);
            }
            if (images.length === 0) {
                images = jQuery(SECOMAPP.pl.pi2sRegex);
            }
        } else {
            images = jQuery("img:not(.sca-fg-img-collect)", productImage);
        }
        var outside = false;
        if (images.length === 0) {
            images = jQuery('img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".jp"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".png"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".JP"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".PNG"]', jQuery(productImage).parent());
            outside = true;
        }
        if (images.length === 0) {
            images = jQuery('img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".jp"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".png"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".JP"],img[src*="/products/"][src*="/cdn.shopify.com/s/files/"][src*=".PNG"]', jQuery(productImage).parent().parent());
            outside = true;
        }
        var image;
        if (images.length === 0) {
            image = jQuery(productImage);
        } else {
            image = images.first();
        }
        var imageParent;
        var href = productImage.getAttribute("href");
        if ((typeof SECOMAPP.pl.lpsPath) == 'undefined') {
            imageParent = image.parents(":not(a):not(.zoomWrapper)").first().addClass("pl-parent");
            if (jQuery('.pl-container.pl-collection', image.parents(".pl-parent").first()).length === 0) {
                image.parents(":not(.zoomWrapper):not(a:has(.zoomWrapper))").first().prepend('<a class="pl-container pl-collection" href="'+ href +'">');
            }
        } else {
            imageParent = image.parents(SECOMAPP.pl.lpsPath).first().addClass("pl-parent");
            if (jQuery('.pl-container.pl-collection', image.parents(".pl-parent").first()).length === 0) {
                image.parents(SECOMAPP.pl.lpsPath).first().prepend('<a class="pl-container pl-collection" href="'+ href +'">');
            }
            outside = true;
        }
        if (outside) productImage = imageParent;
        var $productImage = jQuery(productImage);
        jQuery('.pl-collection', productImage).css({
            "margin-left": SECOMAPP.getMarginWL($productImage),
            "margin-right": SECOMAPP.getMarginWR($productImage),
            "margin-top": SECOMAPP.getMarginH($productImage),
            "margin-bottom": SECOMAPP.getMarginH($productImage),
            padding: SECOMAPP.getPadding($productImage),
        });
        var product = SECOMAPP.pl.products[handle];
        SECOMAPP.pl.showCollectionLabels(product, productImage);
    }

    function resizeLabelImage(productImage) {
        var $productImage = jQuery(productImage);
        jQuery('.pl-collection', productImage).css({
            "margin-left": SECOMAPP.getMarginWL($productImage),
            "margin-right": SECOMAPP.getMarginWR($productImage),
            "margin-top": SECOMAPP.getMarginH($productImage),
            "margin-bottom": SECOMAPP.getMarginH($productImage),
            padding: SECOMAPP.getPadding($productImage),
        });
    }

    // remove element added by liquid in old version
    jQuery("div.pl-container").remove();

    if (SECOMAPP.page === 'product') {
        SECOMAPP.pl.labelProduct();

        jQuery(window).resize(function () {
            var image = getProductImage();
            if (image && image.length > 0) {
                jQuery('.pl-product').css({
                    width: image.width() > 0 ? image.width() : image.get(0).width,
                    height: image.height() > 0 ? image.height() : image.get(0).height,
                    "margin-left": SECOMAPP.getMarginWL(image),
                    "margin-right": SECOMAPP.getMarginWR(image),
                    "margin-top": SECOMAPP.getMarginH(image),
                    "margin-bottom": SECOMAPP.getMarginH(image),
                    padding: SECOMAPP.getPadding(image),
                });
            }
        });

        jQuery('.single-option-selector').change(function () {
            if (!SECOMAPP.isDefined(Shopify.urlParam) ||
                !SECOMAPP.isDefined(Shopify.OptionSelectors)
            ) {
                console.log('No Shopify.OptionSelectors');
                return;
            }
            var variantId = getVariantId();
            if (!variantId) {
                console.log('no variantId');
                return false;
            }

            SECOMAPP.pl.showLabel(variantId);
        });
    }
    if (SECOMAPP.page === 'collection' || SECOMAPP.page === 'home' || SECOMAPP.page === 'search' || SECOMAPP.page === 'cart' || SECOMAPP.page === 'product') {

        SECOMAPP.pl.labelCollections();

        jQuery(window).resize(function () {
            var productImages = getProductImages();
            for (var handle in productImages) {
                var productImage = productImages[handle];

                if (productImage instanceof Array) {
                    productImage.forEach(function (pi) {
                        resizeLabelImage(pi);
                    });
                } else {
                    resizeLabelImage(productImage);
                }
            }
        });

        if (SECOMAPP.page === 'collection' || SECOMAPP.page === 'home' || SECOMAPP.page === 'search' || SECOMAPP.page === 'cart') {
            jQuery(document).ajaxSuccess(function () {
                SECOMAPP.pl.labelCollections();
            });
        }
    }
    SECOMAPP.pl.loadedApp = true;
};

    var SECOMAPP = SECOMAPP || new Object();
    SECOMAPP.pl = SECOMAPP.pl || new Object();
    if ((typeof jQuery === 'undefined')) {
        loadScript('//code.jquery.com/jquery-1.11.1.min.js', function() {
            SECOMAPP.jQuery = jQuery.noConflict();
            SECOMAPP.jQuery.ajaxSetup({
                cache: true
            });
            SECOMAPP.pl.jQuery = SECOMAPP.jQuery;
            SECOMAPP.pl.loadedJs = true;
            startProductLabel2(SECOMAPP, SECOMAPP.jQuery);
        });
    } else {
        jQuery.ajaxSetup({
            cache: true
        });
        SECOMAPP.pl.jQuery = jQuery;
        SECOMAPP.pl.loadedJs = true;
        startProductLabel2(SECOMAPP, jQuery);
    }
