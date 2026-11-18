# Bangla Translation Review Sheet (বাংলা অনুবাদের পর্যালোচনা শীট)

This document lists all user-facing strings in BazarBeat (English vs Bangla) grouped by screen in priority order for human review and verification according to Task 8.10 and `docs/BANGLA_GLOSSARY.md`.

**Total Strings:** 1094

## 1. Bid Panel & Live Bidding (নিলাম ও বিড প্যানেল) (143 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `countdown.extended` | Extended (+2m) | সময় বৃদ্ধি (+২ মি.) |
| `countdown.finalizing` | Finalizing… | চূড়ান্ত হচ্ছে… |
| `countdown.ended` | Auction ended | নিলাম শেষ হয়েছে |
| `countdown.urgent` | Ending soon | শীঘ্রই শেষ হবে |
| `countdown.thresholdWarning` | Auction ending in less than 10 minutes | নিলাম ১০ মিনিটের কম সময়ে শেষ হবে |
| `countdown.thresholdUrgent` | Auction ending in less than 2 minutes | নিলাম ২ মিনিটের কম সময়ে শেষ হবে |
| `countdown.timeLeft` | Time left: {{time}} | বাকি সময়: {{time}} |
| `countdown.urgentTimeLeft` | Ending soon: {{time}} | শীঘ্রই শেষ হবে: {{time}} |
| `countdown.daysHoursLeft` | {{days}}d {{hours}}h | {{days}} দিন {{hours}} ঘণ্টা |
| `countdown.hoursMinutesLeft` | {{hours}}h {{minutes}}m | {{hours}} ঘণ্টা {{minutes}} মিনিট |
| `countdown.minutesSecondsLeft` | {{minutes}}m {{seconds}}s | {{minutes}} মিনিট {{seconds}} সেকেন্ড |
| `countdown.secondsLeft` | {{seconds}}s | {{seconds}} সেকেন্ড |
| `realtime.live` | Live | সরাসরি |
| `realtime.connecting` | Connecting… | সংযোগ হচ্ছে… |
| `realtime.reconnecting` | Reconnecting… | পুনরায় সংযোগ হচ্ছে… |
| `realtime.offline` | Offline | অফলাইন |
| `realtime.bidsCount_zero` | No bids yet | এখনো কোনো বিড নেই |
| `realtime.bidsCount_one` | 1 bid | ১টি বিড |
| `realtime.bidsCount_other` | {{count}} bids | {{count}}টি বিড |
| `realtime.newBid` | New bid | নতুন বিড |
| `realtime.newBidPlaced` | New bid placed: {{amount}} | নতুন বিড: {{amount}} |
| `realtime.auctionExtended` | Auction extended by 2 minutes | নিলামের সময় ২ মিনিট বাড়ানো হয়েছে |
| `realtime.auctionClosed` | Auction ended: {{status}} | নিলাম শেষ: {{status}} |
| `cropBidding.title` | Crop Bidding | ফসলের নিলাম ও দর |
| `cropBidding.subtitle` | Manage your live produce auctions and review bidding results. | আপনার সরাসরি ফসলের নিলাম পরিচালনা করুন এবং বিডের ফলাফল দেখুন। |
| `cropBidding.tabs.live` | Live Auctions | চলমান নিলাম |
| `cropBidding.tabs.ended` | Ended Auctions | সমাপ্ত নিলাম |
| `cropBidding.liveBadge` | LIVE | সরাসরি |
| `cropBidding.floorPrice` | Floor: | সর্বনিম্ন দর: |
| `cropBidding.currentPrice` | Current highest: | বর্তমান সর্বোচ্চ: |
| `cropBidding.openingPrice` | Opening floor: | শুরুর দর: |
| `cropBidding.noBidsYet` | No bids yet | এখনো কোনো বিড নেই |
| `cropBidding.bidCount_zero` | 0 bids | ০টি বিড |
| `cropBidding.bidCount_one` | 1 bid | ১টি বিড |
| `cropBidding.bidCount_other` | {{count}} bids | {{count}}টি বিড |
| `cropBidding.bidHistory` | Bid History | বিডের ইতিহাস |
| `cropBidding.hideHistory` | Hide History | ইতিহাস লুকান |
| `cropBidding.viewHistory` | View Bid History | বিডের ইতিহাস দেখুন |
| `cropBidding.anonymizedBidder` | {{label}} | {{label}} |
| `cropBidding.noHistory` | No bids placed yet for this auction. | এই নিলামের জন্য এখনো কোনো বিড জমা পড়েনি। |
| `cropBidding.actions.cancel` | Cancel Auction | নিলাম বাতিল করুন |
| `cropBidding.actions.acceptNow` | Accept Now | এখনই গ্রহণ করুন |
| `cropBidding.actions.relist` | Relist Auction | পুনরায় তালিকাভুক্ত করুন |
| `cropBidding.actions.viewOrder` | View Order | অর্ডার দেখুন |
| `cropBidding.cancelDialog.title` | Cancel this auction? | নিলামটি বাতিল করতে চান? |
| `cropBidding.cancelDialog.description` | Are you sure you want to cancel this auction? Since there are no bids, reserved crop stock will be released back to your available inventory. | আপনি কি নিশ্চিত যে আপনি এই নিলামটি বাতিল করতে চান? যেহেতু কোনো বিড নেই, সংরক্ষিত ফসলের মজুত আপনার উপলব্ধ মজুতে ফেরত যাবে। |
| `cropBidding.cancelDialog.confirm` | Yes, Cancel Auction | হ্যাঁ, নিলাম বাতিল করুন |
| `cropBidding.cancelDialog.keep` | Keep Auction Active | নিলাম চালু রাখুন |
| `cropBidding.cancelDialog.cancelling` | Cancelling… | বাতিল হচ্ছে… |
| `cropBidding.acceptDialog.title` | Accept current highest bid? | বর্তমান সর্বোচ্চ বিড গ্রহণ করবেন? |
| `cropBidding.acceptDialog.description` | Are you sure you want to accept this bid now? The auction will close immediately and create an order at the current price. | আপনি কি এখনই এই বিডটি গ্রহণ করতে চান? নিলামটি তাৎক্ষণিকভাবে শেষ হবে এবং বর্তমান দরে একটি অর্ডার তৈরি হবে। |
| `cropBidding.acceptDialog.priceLabel` | Winning Price per kg: | প্রতি কেজির দর: |
| `cropBidding.acceptDialog.totalLabel` | Total Payout Value: | মোট প্রাপ্তি মূল্য: |
| `cropBidding.acceptDialog.confirm` | Yes, Accept Bid & Close | হ্যাঁ, বিড গ্রহণ ও নিলাম সমাপ্ত করুন |
| `cropBidding.acceptDialog.keep` | Continue Auction | নিলাম চালিয়ে যান |
| `cropBidding.acceptDialog.accepting` | Accepting… | গ্রহণ করা হচ্ছে… |
| `cropBidding.relistDialog.title` | Relist Crop Auction | ফসল পুনরায় নিলামে দিন |
| `cropBidding.relistDialog.description` | Create a new auction for your unsold produce with updated pricing and duration. | নতুন মূল্য ও সময়সীমা নির্ধারণ করে অবিক্রীত ফসল পুনরায় নিলামে তুলুন। |
| `cropBidding.relistDialog.cropLabel` | Crop | ফসল |
| `cropBidding.relistDialog.quantityLabel` | Quantity | পরিমাণ |
| `cropBidding.relistDialog.floorPriceLabel` | Suggested Floor Price (৳/kg) | প্রস্তাবিত সর্বনিম্ন দর (৳/কেজি) |
| `cropBidding.relistDialog.suggestedFloorHint` | Suggested: ৳{{amount}}/kg | প্রস্তাবিত: ৳{{amount}}/কেজি |
| `cropBidding.relistDialog.durationLabel` | Auction Duration | নিলামের সময়কাল |
| `cropBidding.relistDialog.pickupNoteLabel` | Pickup Note (optional) | হস্তান্তর নোট (ঐচ্ছিক) |
| `cropBidding.relistDialog.confirm` | Relist Now | এখনই পুনরায় তালিকাভুক্ত করুন |
| `cropBidding.relistDialog.cancel` | Cancel | বাতিল |
| `cropBidding.relistDialog.relisting` | Relisting… | তালিকাভুক্ত হচ্ছে… |
| `cropBidding.sold.label` | Sold | বিক্রি হয়েছে |
| `cropBidding.sold.winningPrice` | Winning Price: | বিজয়ী দর: |
| `cropBidding.sold.viewOrder` | View Order | অর্ডার দেখুন |
| `cropBidding.unsold.label` | Not Sold | বিক্রি হয়নি |
| `cropBidding.unsold.message` | Not sold. Sell at your local market, or relist. | বিক্রি হয়নি। স্থানীয় বাজারে বিক্রি করুন, অথবা পুনরায় তালিকাভুক্ত করুন। |
| `cropBidding.unsold.fallbackHint` | You can still sell this crop at your local market with zero platform risk, or relist with an adjusted floor price. | আপনি কোনো প্ল্যাটফর্ম ঝুঁকি ছাড়াই এই ফসলটি আপনার স্থানীয় বাজারে বিক্রি করতে পারেন, অথবা নতুন সর্বনিম্ন দর দিয়ে পুনরায় তালিকাভুক্ত করতে পারেন। |
| `cropBidding.cancelled.label` | Cancelled | বাতিল |
| `cropBidding.cancelled.message` | This auction was cancelled. Stock was returned to inventory. | এই নিলামটি বাতিল করা হয়েছে। মজুত ফেরত দেওয়া হয়েছে। |
| `cropBidding.newBidToast` | New bid on {{crop}}: {{amount}} by {{bidder}} | {{crop}}-এ নতুন বিড: {{amount}} ({{bidder}}) |
| `cropBidding.emptyLive` | No live auctions | কোনো চলমান নিলাম নেই |
| `cropBidding.emptyLiveDesc` | You don't have any active auctions right now. Create a new listing to start receiving bids. | বর্তমানে আপনার কোনো সক্রিয় নিলাম নেই। ক্রেতাদের কাছ থেকে বিড পেতে একটি নতুন তালিকা তৈরি করুন। |
| `cropBidding.emptyEnded` | No ended auctions | কোনো সমাপ্ত নিলাম নেই |
| `cropBidding.emptyEndedDesc` | You don't have any completed or expired auctions yet. | আপনার কোনো সম্পন্ন বা মেয়াদোত্তীর্ণ নিলাম এখনো নেই। |
| `cropBidding.createNew` | New Listing | নতুন তালিকা তৈরি করুন |
| `cropBidding.loadError` | Could not load bidding data. Check your connection and try again. | নিলামের তথ্য লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন। |
| `cropBidding.retry` | Try again | আবার চেষ্টা করুন |
| `cropBidding.forbidden` | Access forbidden. Crop bidding is only accessible to farmers. | অনুমতি নেই। ফসলের নিলাম শুধুমাত্র কৃষকদের জন্য। |
| `cropBidding.loginAsFarmer` | Please log in with a farmer account. | অনুগ্রহ করে কৃষক অ্যাকাউন্ট দিয়ে লগইন করুন। |
| `bidPanel.title` | Place a Bid | বিড জমা দিন |
| `bidPanel.activeSubtitle` | Bids are binding for the entire lot. | পুরো লটের জন্য বিড বাধ্যতামূলক ও আইনসম্মত। |
| `bidPanel.minNextBid` | Minimum next bid: | পরবর্তী সর্বনিম্ন বিড: |
| `bidPanel.suggestedBids` | Quick bid amounts: | সহজ বিডের পরিমাণ: |
| `bidPanel.customAmount` | Your bid per kg (৳/kg): | আপনার প্রতি কেজির দর (৳/কেজি): |
| `bidPanel.customAmountPlaceholder` | e.g. 45.00 | যেমন: ৪৫.০০ |
| `bidPanel.unitKg` | ৳/kg | ৳/কেজি |
| `bidPanel.totalCostPreview` | Live total cost preview ({{quantity}} kg): | মোট আনুমানিক মূল্য ({{quantity}} কেজি): |
| `bidPanel.placeBidButton` | Place Bid | বিড করুন |
| `bidPanel.status.notBidding` | You haven't placed a bid on this listing yet. | আপনি এখনো এই তালিকায় কোনো বিড দেননি। |
| `bidPanel.status.winning` | You're winning! You currently hold the highest bid. | আপনি এগিয়ে আছেন! বর্তমান সর্বোচ্চ বিডটি আপনার। |
| `bidPanel.status.outbid` | You were outbid by {{gap}}. Place a higher bid to win. | অন্য ক্রেতা {{gap}}-এ আপনাকে ছাড়িয়ে গেছেন। এগিয়ে থাকতে বেশি দর দিন। |
| `bidPanel.status.won` | You won this lot! | আপনি এই লটটি জিতেছেন! |
| `bidPanel.status.lost` | Auction ended. Another bidder won. | নিলাম শেষ। অন্য ক্রেতা জিতেছেন। |
| `bidPanel.dialog.title` | Confirm Your Binding Bid | বাধ্যতামূলক বিড নিশ্চিত করুন |
| `bidPanel.dialog.disclaimer` | Bids on BazarBeat are legally binding commitments to purchase the entire lot if you win the auction. Bids cannot be retracted or cancelled. | বাজারবিটের সকল বিড বাধ্যতামূলক। নিলামে জিতলে পুরো লট ক্রয় করার আইনি দায়বদ্ধতা থাকবে। বিড বাতিল বা প্রত্যাহার করা যায় না। |
| `bidPanel.dialog.pricePerKg` | Bid price per kg | প্রতি কেজির দর |
| `bidPanel.dialog.quantity` | Total quantity | মোট পরিমাণ |
| `bidPanel.dialog.totalCost` | Total purchase amount | মোট পরিশোধ মূল্য |
| `bidPanel.dialog.cancel` | Cancel | বাতিল |
| `bidPanel.dialog.confirm` | Confirm & Submit Bid | বিড নিশ্চিত ও জমা দিন |
| `bidPanel.dialog.submitting` | Submitting bid… | বিড জমা হচ্ছে… |
| `bidPanel.errors.bidTooLow` | Your bid is too low. The minimum required bid is {{min}}. | আপনার বিড কম হয়েছে। পরবর্তী সর্বনিম্ন বিড হতে হবে {{min}}। |
| `bidPanel.errors.bidMinimumAction` | Bid minimum ({{min}}) | সর্বনিম্ন বিড দিন ({{min}}) |
| `bidPanel.errors.auctionClosed` | This auction has closed and is no longer accepting bids. | এই নিলামের সময় শেষ এবং আর কোনো বিড গ্রহণ করা হচ্ছে না। |
| `bidPanel.errors.ownListing` | You cannot bid on your own listing. | আপনি নিজের তালিকায় বিড দিতে পারবেন না। |
| `bidPanel.errors.selfOutbid` | You are already the highest bidder. | আপনি ইতিমধ্যে সর্বোচ্চ বিডকারী। |
| `bidPanel.errors.forbidden` | You do not have permission to bid on this listing. | এই তালিকায় বিড দেওয়ার অনুমতি নেই। |
| `bidPanel.errors.invalidAmount` | Enter a valid positive price with up to 2 decimal places. | সর্বোচ্চ ২ দশমিক পর্যন্ত সঠিক ইতিবাচক দর দিন। |
| `bidPanel.errors.generic` | Could not place bid. Please try again. | বিড জমা দেওয়া যায়নি। আবার চেষ্টা করুন। |
| `myBids.title` | My Bids | আমার দর |
| `myBids.subtitle` | Track your active bids, monitor outbid status, and view won auctions. | আপনার চলমান বিডগুলো ট্র্যাক করুন, আউতবেড স্ট্যাটাস লক্ষ্য করুন এবং জয়ী নিলাম দেখুন। |
| `myBids.tabs.active` | Active | চলমান |
| `myBids.tabs.won` | Won | জয়ী |
| `myBids.tabs.lost` | Lost | পরাজিত |
| `myBids.status.winning` | Winning | সর্বোচ্চ দরদাতা |
| `myBids.status.outbid` | Outbid | দর অতিক্রম করেছে |
| `myBids.status.won` | Won | জয়ী |
| `myBids.status.lost` | Lost | পরাজিত |
| `myBids.yourBid` | Your bid: | আপনার দর: |
| `myBids.currentPrice` | Current price: | বর্তমান দর: |
| `myBids.finalPrice` | Final price: | চূড়ান্ত দর: |
| `myBids.gapBehind` | Behind by {{amount}}/kg | {{amount}}/কেজি পিছিয়ে |
| `myBids.quantity` | Quantity: {{quantity}} kg | পরিমাণ: {{quantity}} কেজি |
| `myBids.total` | Total: {{amount}} | মোট: {{amount}} |
| `myBids.bidsCount` | {{count}} bids | {{count}}টি বিড |
| `myBids.raiseBid` | Raise bid | দর বাড়ান |
| `myBids.viewOrder` | View order | অর্ডার দেখুন |
| `myBids.viewListing` | View listing | তালিকা দেখুন |
| `myBids.exploreMarketplace` | Explore Marketplace | বাজার দেখুন |
| `myBids.loadError` | Failed to load your bids. Please try again. | বিডের তথ্য লোড করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। |
| `myBids.retry` | Retry | আবার চেষ্টা করুন |
| `myBids.emptyActiveTitle` | No active bids | কোনো চলমান বিড নেই |
| `myBids.emptyActiveDesc` | You don't have any active bids right now. Browse produce in the marketplace to start bidding. | আপনার এই মুহূর্তে কোনো চলমান বিড নেই। বিড করতে বাজার থেকে ফসল বেছে নিন। |
| `myBids.emptyWonTitle` | No won auctions yet | এখনো কোনো জয়ী নিলাম নেই |
| `myBids.emptyWonDesc` | Auctions you win will appear here with your confirmed orders. | আপনার জয় করা নিলামগুলো অর্ডারসহ এখানে দেখা যাবে। |
| `myBids.emptyLostTitle` | No lost bids | কোনো পরাজিত বিড নেই |
| `myBids.emptyLostDesc` | Auctions where you were outbid and did not win will appear here. | যেসব নিলামে অন্য কেউ বেশি দর দিয়েছে সেগুলো এখানে দেখা যাবে। |

---

## 2. New Listing Wizard & AI Grading (লিস্টিং উইজার্ড ও এআই গ্রেডিং) (182 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `aiReasons.grading.COLOR_UNIFORM` | Consistent color | একই রকম রঙ |
| `aiReasons.grading.SHAPE_REGULAR` | Regular shape | স্বাভাবিক আকার |
| `aiReasons.grading.TEXTURE_FIRM` | Firm texture | শক্ত ও সতেজ গঠন |
| `aiReasons.grading.SKIN_INTACT` | Sound skin with no rot or damage | পচন বা দাগহীন ভালো ত্বক |
| `aiReasons.grading.MINOR_BLEMISHES` | Minor surface blemishes | পৃষ্ঠে সামান্য দাগ |
| `aiReasons.grading.SIZE_VARIATION` | Slight size variation | আকারে সামান্য তারতম্য |
| `aiReasons.grading.SURFACE_DEFECTS` | Surface defects present | পৃষ্ঠে ত্রুটি বিদ্যমান |
| `aiReasons.grading.MATURITY_OPTIMAL` | Optimal crop maturity | উপযুক্ত পরিপক্কতা |
| `aiReasons.grading.FRESH_HARVEST` | Freshly harvested produce | সদ্য আহরিত ফসল |
| `aiReasons.grading.MOISTURE_COMPLIANT` | Optimal moisture content | সঠিক আর্দ্রতা স্তর |
| `aiReasons.grading.VISUAL_AI_EVALUATED` | Visual quality evaluated by AI | এআই দ্বারা গুণমান মূল্যায়নকৃত |
| `aiReasons.price.TREND_UP` | Recent market prices trending upward | সাম্প্রতিক বাজারদর ঊর্ধ্বমুখী |
| `aiReasons.price.TREND_DOWN` | Recent market prices trending downward | সাম্প্রতিক বাজারদর নিম্নমুখী |
| `aiReasons.price.TREND_FLAT` | Market prices currently stable | বাজারদর বর্তমানে স্থিতিশীল |
| `aiReasons.price.DEMAND_HIGH` | High wholesale demand | পাইকারি চাহিদা বেশি |
| `aiReasons.price.DEMAND_STABLE` | Steady market demand | স্থিতিশীল বাজার চাহিদা |
| `aiReasons.price.SUPPLY_SURPLUS` | Supply surplus observed in division | বিভাগে অতিরিক্ত সরবরাহ বিদ্যমান |
| `aiReasons.price.HISTORICAL_BENCHMARK` | Historical price benchmark for Grade {{grade}} | গ্রেড {{grade}}-এর জন্য ঐতিহাসিক বেঞ্চমার্ক দর |
| `aiReasons.price.DIVISION_PREMIUM` | Regional division price premium applied | আঞ্চলিক প্রিমিয়াম প্রযোজ্য |
| `aiReasons.price.GRADE_PREMIUM` | Premium applied for higher quality grade | উন্নত মানের জন্য প্রিমিয়াম প্রযোজ্য |
| `stepper.step` | Step | ধাপ |
| `stepper.of` | of | এর |
| `stepper.crop` | Crop | ফসল |
| `stepper.photos` | Photos | ছবি |
| `stepper.aiGrade` | AI Grade | এআই গ্রেড |
| `stepper.price` | Price | দাম |
| `stepper.quantityTimer` | Quantity & Timer | পরিমাণ ও সময় |
| `stepper.review` | Review | পর্যালোচনা |
| `imageUploader.camera` | Take photo | ছবি তুলুন |
| `imageUploader.gallery` | Choose files | ফাইল বাছুন |
| `imageUploader.photos` | photos | ছবি |
| `imageUploader.cropPhotos` | Crop photos | ফসলের ছবি |
| `imageUploader.retakeAll` | Retake all | সব নতুন করে তুলুন |
| `imageUploader.addMore` | Add more | আরও যোগ করুন |
| `imageUploader.dragOrClick` | Upload 1 to 4 clear photos | ১ থেকে ৪টি স্পষ্ট ছবি আপলোড করুন |
| `imageUploader.formats` | JPEG, PNG, or WebP up to 5 MB each | প্রতিটি সর্বোচ্চ ৫ এমবি, জেপিইজি, পিএনজি বা ওয়েবপি |
| `imageUploader.typeError` | Only JPEG, PNG, and WebP images are supported. | শুধুমাত্র JPEG, PNG এবং WebP ছবি সমর্থিত। |
| `imageUploader.limitError` | You can upload up to {{max}} photos. | আপনি সর্বোচ্চ {{max}}টি ছবি আপলোড করতে পারবেন। |
| `photoTips.cardTitle` | Tips for best AI quality grading | সঠিক এআই গ্রেডিংয়ের জন্য টিপস |
| `photoTips.lightTitle` | Natural daylight | দিনের স্বাভাবিক আলো |
| `photoTips.lightDesc` | Take photos in daylight. Avoid dark areas and harsh flashes. | দিনের আলোতে ছবি তুলুন। অন্ধকার জায়গা বা কড়া ফ্ল্যাশ এড়িয়ে চলুন। |
| `photoTips.backgroundTitle` | Plain background | সাদামাটা পটভূমি |
| `photoTips.backgroundDesc` | Place crop on a clean floor, mat, or sack. | পরিষ্কার মেঝে, চাটাই বা বস্তার উপর ফসল রাখুন। |
| `photoTips.multiTitle` | Show 3+ pieces | ৩ বা ততোধিক রাখুন |
| `photoTips.multiDesc` | Show several pieces together, then 1 close-up photo. | কয়েকটি একসাথে দেখান, তারপর ১টি কাছ থেকে ছবি তুলুন। |
| `photoTips.clearTitle` | Clear and unobstructed | স্পষ্ট ও বাধাহীন |
| `photoTips.clearDesc` | No hands covering the crop. Do not apply beauty or color filters. | ফসল হাত দিয়ে ঢাকবেন না। কোনো ফিল্টার ব্যবহার করবেন না। |
| `wizard.pageTitle` | Create a new auction listing | নতুন নিলাম তালিকা তৈরি করুন |
| `wizard.pageSubtitle` | List your harvest with AI grading and price guidance in 6 simple steps. | ৬টি সহজ ধাপে এআই গ্রেডিং ও দামের নির্দেশনাসহ ফসল তালিকাভুক্ত করুন। |
| `wizard.loadingCrops` | Loading available crops… | উপলভ্য ফসল লোড হচ্ছে… |
| `wizard.cropsLoadError` | Could not load crops list. | ফসলের তালিকা লোড করা যায়নি। |
| `wizard.cropList` | Available crops | উপলভ্য ফসল |
| `wizard.step1Title` | Select the crop you want to sell | যে ফসলটি বিক্রি করতে চান তা নির্বাচন করুন |
| `wizard.step1Subtitle` | Choose one of our 5 verified marketplace crops to start AI grading. | এআই গ্রেডিং শুরু করতে আমাদের ৫টি যাচাইকৃত ফসলের একটি বাছুন। |
| `wizard.lotSize` | Lot: | লট: |
| `wizard.shelfLife` | Shelf life: | সংরক্ষণকাল: |
| `wizard.continue` | Continue to photos | ছবির ধাপে যান |
| `wizard.back` | Change crop | ফসল পরিবর্তন করুন |
| `wizard.step2Title` | Take or upload photos of your harvest | আপনার ফসলের ছবি তুলুন বা আপলোড করুন |
| `wizard.step2Subtitle` | Upload 1 to 4 clear photos for AI grading and price guidance. | এআই গ্রেডিং ও দামের নির্দেশনার জন্য ১ থেকে ৪টি স্পষ্ট ছবি আপলোড করুন। |
| `wizard.assessQuality` | Assess quality with AI | এআই দিয়ে মান যাচাই করুন |
| `wizard.assessing` | Analyzing quality with AI… | এআই দিয়ে মান বিশ্লেষণ হচ্ছে… |
| `wizard.step3Title` | Quality Assessment Result | মানের মূল্যায়ন ফলাফল |
| `wizard.aiAssessed` | AI-assessed | এআই মূল্যায়িত |
| `wizard.aiAssessedTooltip` | This grade is generated by our AI model based on visual quality features. It serves as an objective market benchmark. | এই গ্রেডটি ছবির বৈশিষ্ট্যের ওপর ভিত্তি করে এআই মডেল দ্বারা তৈরি। এটি বাজারের একটি বস্তুনিষ্ঠ মানদণ্ড। |
| `wizard.confidenceLevel` | Confidence | বিশ্বাসযোগ্যতা |
| `wizard.confidenceHigh` | High confidence | উচ্চ নির্ভরযোগ্যতা |
| `wizard.confidenceMedium` | Medium confidence | মাঝারি নির্ভরযোগ্যতা |
| `wizard.confidenceLow` | Low confidence | কম নির্ভরযোগ্যতা |
| `wizard.reasons` | Quality Observations & Reasons | মানের পর্যবেক্ষণ ও কারণ |
| `wizard.degradedNotice` | AI grading service is operating in offline estimate mode. Grade calculated from baseline criteria. | এআই সার্ভিসটি অফলাইন মোডে চলছে। প্রাথমিক মানদণ্ড অনুসারে গ্রেড হিসাব করা হয়েছে। |
| `wizard.retakePhotos` | Retake photos | আবার ছবি তুলুন |
| `wizard.changeCrop` | Change crop | ফসল পরিবর্তন করুন |
| `wizard.continueToPrice` | Continue to Price Guidance | দামের নির্দেশনায় যান |
| `wizard.cropMismatchTitle` | Crop mismatch detected | ফসলের অমিল পাওয়া গেছে |
| `wizard.cropMismatchDesc` | The uploaded photo does not appear to match {{cropName}}. Please retake the photo showing the correct crop, or choose a different crop. | আপলোড করা ছবিটি {{cropName}}-এর সাথে মিলছে না। সঠিক ফসলের ছবি তুলুন অথবা অন্য ফসল বাছুন। |
| `wizard.gradeUnavailableTitle` | Quality grade unavailable | মানের গ্রেড নির্ধারণ করা যায়নি |
| `wizard.gradeUnavailableDesc` | Our AI model could not grade this photo with sufficient confidence (confidence below 55%). This usually happens when lighting is poor, the background is cluttered, or the crop is partially obscured. | আমাদের এআই মডেল পর্যাপ্ত নিশ্চিত হতে পারেনি (বিশ্বাসযোগ্যতা ৫৫%-এর কম)। আলো কম থাকলে বা ছবি অস্পষ্ট হলে সাধারণত এমন হয়। |
| `wizard.howToFix` | How to take a gradable photo: | যেভাবে সঠিক ছবি তুলবেন: |
| `wizard.assessmentFailed` | Assessment could not be completed | মূল্যায়ন সম্পন্ন করা যায়নি |
| `wizard.noAssessment` | No assessment found. Please upload photos first. | কোনো মূল্যায়ন পাওয়া যায়নি। প্রথমে ছবি আপলোড করুন। |
| `wizard.backToPhotos` | Upload photos | ছবি আপলোড করুন |
| `wizard.nextPhaseTitle` | Step {{step}} will be available in the next task. | {{step}} নম্বর ধাপটি পরবর্তী টাস্কে যুক্ত হবে। |
| `wizard.nextPhaseSubtitle` | Steps 1 to 3 (Crop, Photos, and AI Result) are complete. Price guidance and auction publishing will continue in the next phase. | ১ থেকে ৩ নম্বর ধাপ (ফসল, ছবি এবং এআই ফলাফল) সম্পন্ন হয়েছে। |
| `wizard.backToAiResult` | Back to AI Result | এআই ফলাফলে ফিরে যান |
| `wizard.step4Title` | Price Guidance & Floor Price | দামের নির্দেশনা ও সর্বনিম্ন দর |
| `wizard.step4Subtitle` | Review AI market estimate and set your minimum acceptable floor price. | এআই বাজারদর দেখুন এবং আপনার গ্রহণযোগ্য সর্বনিম্ন দর (ফ্লোর প্রাইস) নির্ধারণ করুন। |
| `wizard.aiMarketRange` | AI Market Price Range | এআই বাজারদরের সীমা |
| `wizard.low` | Low | কম |
| `wizard.expected` | Expected | প্রত্যাশিত |
| `wizard.high` | High | বেশি |
| `wizard.trendUp` | Prices trending up | বাজারদর ঊর্ধ্বমুখী |
| `wizard.trendFlat` | Prices stable | বাজারদর স্থিতিশীল |
| `wizard.trendDown` | Prices trending down | বাজারদর নিম্নমুখী |
| `wizard.localMarketCardTitle` | Local market estimate | স্থানীয় বাজারদর অনুমান |
| `wizard.localMarketCardDesc` | Based on recent mandi/bazar transactions, this is what you could expect selling locally. | সাম্প্রতিক স্থানীয় বাজার লেনদেনের ভিত্তিতে এটি আপনার অনুমিত দর। |
| `wizard.localSellingCost` | Local selling cost (transport, commission) - optional | স্থানীয় বিক্রি খরচ (পরিবহন, কমিশন) - ঐচ্ছিক |
| `wizard.localSellingCostHint` | Enter estimated expenses per kg to tailor your suggested floor. | সুপারিশকৃত ফ্লোর ঠিক করতে প্রতি কেজির খরচ লিখুন। |
| `wizard.updateGuidance` | Update | আপডেট |
| `wizard.useSuggestedFloor` | Use suggested floor | সুপারিশকৃত দর ব্যবহার করুন |
| `wizard.floorPriceLabel` | Your floor price (৳/kg) | আপনার সর্বনিম্ন দর (৳/কেজি) |
| `wizard.floorPriceHelp` | Bids below this floor price will never be accepted. | এই দরের নিচের কোনো বিড গ্রহণ করা হবে না। |
| `wizard.floorWarningBelowMarket` | Warning: Your floor price is below the AI market range. You may be selling for less than market value. | সতর্কতা: আপনার ফ্লোর প্রাইস বাজারদরের নিচে। আপনি কম দামে বিক্রি করার ঝুঁকিতে থাকতে পারেন। |
| `wizard.floorWarningOverpriced` | Warning: Your floor price is more than 30% above the high market price. Your listing may not receive qualifying bids. | সতর্কতা: আপনার ফ্লোর প্রাইস বাজারদরের সর্বোচ্চ সীমার ৩০% বেশি। ক্রেতারা বিড নাও করতে পারে। |
| `wizard.floorPriceOk` | Floor price is within the recommended market range. | ফ্লোর প্রাইস প্রস্তাবিত বাজারদরের সীমার মধ্যে রয়েছে। |
| `wizard.reassuranceText` | If no bid reaches your floor, you can still sell in your local market. | কোনো বিড আপনার ফ্লোর প্রাইসে না পৌঁছালে, আপনি আপনার স্থানীয় বাজারে বিক্রি করতে পারবেন। |
| `wizard.continueToQuantity` | Continue to Quantity & Timer | পরিমাণ ও সময় ধাপে যান |
| `wizard.loadingGuidance` | Fetching price guidance… | দামের নির্দেশনা আনা হচ্ছে… |
| `wizard.guidanceError` | Failed to retrieve price guidance. Please try again. | দামের নির্দেশনা আনা যায়নি। আবার চেষ্টা করুন। |
| `wizard.step5Title` | Lot Quantity & Auction Duration | লটের পরিমাণ ও নিলামের সময়কাল |
| `wizard.step5Subtitle` | Choose how much available stock to sell and how long the bidding lasts. | মজুত থেকে কতটুকু বিক্রি করবেন এবং নিলাম কতক্ষণ চলবে তা নির্বাচন করুন। |
| `wizard.availableStock` | Available in stock: | মজুত উপলব্ধ: |
| `wizard.lotRange` | Allowed lot range: | অনুমোদিত লট সীমা: |
| `wizard.shelfLifeLimit` | Shelf life cap: | সংরক্ষণসীমা: |
| `wizard.insufficientStockWarning` | You do not have enough stock in inventory to meet the minimum lot of {{minLotKg}} kg. | ন্যূনতম লট ({{minLotKg}} কেজি) পূরণের মতো পর্যাপ্ত মজুত নেই। |
| `wizard.insufficientStockDesc` | Please add harvest stock to your inventory first, then enter the quantity to sell. | প্রথমে মজুত যোগ করুন, তারপর বিক্রির পরিমাণ দিন। |
| `wizard.quantityLabel` | Quantity to sell (kg) | বিক্রির পরিমাণ (কেজি) |
| `wizard.quantityBelowMin` | Quantity must be at least {{minLotKg}} kg. | পরিমাণ কমপক্ষে {{minLotKg}} কেজি হতে হবে। |
| `wizard.quantityAboveMax` | Quantity cannot exceed crop limit of {{maxLotKg}} kg. | পরিমাণ {{maxLotKg}} কেজির বেশি হতে পারবে না। |
| `wizard.quantityAboveStock` | Quantity exceeds your available stock of {{availableKg}} kg. | পরিমাণ আপনার উপলব্ধ মজুত ({{availableKg}} কেজি)-এর বেশি হতে পারবে না। |
| `wizard.durationLabel` | Auction duration | নিলামের সময়কাল |
| `wizard.durationHelp` | Capped by crop shelf life (max {{maxHours}} hours). | ফসলের সংরক্ষণসীমা দ্বারা সীমাবদ্ধ (সর্বোচ্চ {{maxHours}} ঘণ্টা)। |
| `wizard.pickupNoteLabel` | Pickup / Handover note (optional) | পণ্য হস্তান্তরের নোট (ঐচ্ছিক) |
| `wizard.pickupNotePlaceholder` | e.g., Sonapur Bazar storage shed #2, contact on arrival | যেমন, সোনাপুর বাজার ২ নম্বর আড়ত, আসার আগে ফোন দিন |
| `wizard.pickupNoteHint` | Visible to the winning bidder after auction completion. | নিলাম শেষ হলে বিজয়ী ক্রেতা এই তথ্য দেখতে পাবেন। |
| `wizard.continueToReview` | Continue to Review | পর্যালোচনায় যান |
| `wizard.backToPrice` | Back to Price Guidance | দামের নির্দেশনায় ফিরে যান |
| `wizard.step6Title` | Review & Publish Listing | পর্যালোচনা ও নিলাম প্রকাশ |
| `wizard.step6Subtitle` | Verify all listing details before launching your live auction. | নিলাম শুরু করার আগে সমস্ত বিবরণ যাচাই করুন। |
| `wizard.summaryCrop` | Crop | ফসল |
| `wizard.summaryGrade` | AI Quality Grade | এআই মান গ্রেড |
| `wizard.summaryQuantity` | Quantity | পরিমাণ |
| `wizard.summaryFloorPrice` | Floor Price | সর্বনিম্ন দর |
| `wizard.summaryTotalFloorValue` | Minimum Total Value | সর্বনিম্ন মোট মূল্য |
| `wizard.summaryDuration` | Duration | সময়কাল |
| `wizard.summaryPickupNote` | Pickup Note | পণ্য হস্তান্তরের নোট |
| `wizard.publishListing` | Publish Listing | নিলাম প্রকাশ করুন |
| `wizard.publishing` | Publishing listing… | নিলাম প্রকাশ হচ্ছে… |
| `wizard.publishFailed` | Could not publish listing. Please check the details and try again. | নিলাম প্রকাশ করা যায়নি। অনুগ্রহ করে বিবরণ পরীক্ষা করে আবার চেষ্টা করুন। |
| `wizard.backToQuantity` | Back to Quantity & Timer | পরিমাণ ও সময় ধাপে ফিরে যান |
| `wizard.publishSuccessTitle` | Listing published successfully! | নিলাম সফলভাবে প্রকাশিত হয়েছে! |
| `wizard.publishSuccessDesc` | Your auction is now LIVE for buyers to bid on. | আপনার নিলামটি এখন ক্রেতাদের বিডের জন্য উন্মুক্ত। |
| `wizard.startsAt` | Started at: | শুরু হয়েছে: |
| `wizard.endsAt` | Ends at: | শেষ হবে: |
| `wizard.viewCropBidding` | Go to Crop Bidding | ফসলের দর পাতায় যান |
| `wizard.viewMyListings` | View My Listings | আমার তালিকা দেখুন |
| `wizard.createAnother` | Create Another Listing | আরেকটি তালিকা তৈরি করুন |
| `wizard.publishErrorInsufficientStock` | You do not have enough available stock for this listing. | এই তালিকার জন্য আপনার পর্যাপ্ত মজুত নেই। |
| `wizard.publishErrorConflict` | This assessment token has already been used or expired. Please retake photos. | এই এআই মূল্যায়ন টোকেনটি ইতিমধ্যে ব্যবহৃত বা মেয়াদোত্তীর্ণ হয়েছে। অনুগ্রহ করে নতুন ছবি তুলুন। |
| `wizard.publishErrorValidation` | Please check your inputs and try again. | তথ্য যাচাই করে আবার চেষ্টা করুন। |
| `listings.title` | My Listings | আমার তালিকা |
| `listings.subtitle` | Track and manage your produce auctions. | আপনার ফসলের নিলাম ট্র্যাক ও পরিচালনা করুন। |
| `listings.createNew` | New Listing | নতুন তালিকা |
| `listings.statusFilter` | Filter by status | স্ট্যাটাস অনুসারে ফিল্টার |
| `listings.filterAll` | All | সব |
| `listings.filterActive` | Active | চলমান |
| `listings.filterSold` | Sold | বিক্রি হয়েছে |
| `listings.filterExpired` | Expired | মেয়াদোত্তীর্ণ |
| `listings.filterCancelled` | Cancelled | বাতিল |
| `listings.noListings` | No listings found | কোনো তালিকা পাওয়া যায়নি |
| `listings.noListingsDesc` | You haven't listed any crops with this status yet. | এই স্ট্যাটাসে আপনার কোনো তালিকা নেই। |
| `listings.loadError` | Could not load listings. Please check your connection. | তালিকা লোড করা যায়নি। অনুগ্রহ করে সংযোগ পরীক্ষা করুন। |
| `listings.viewDetails` | View details | বিস্তারিত দেখুন |
| `listings.floorPrice` | Floor: | সর্বনিম্ন দর: |
| `listings.currentBid` | Highest bid: | সর্বোচ্চ বিড: |
| `listings.noBidsYet` | No bids yet | এখনো কোনো বিড নেই |
| `listings.quantity` | Quantity: | পরিমাণ: |
| `listings.drawerTitle` | Listing Details | তালিকার বিবরণ |
| `listings.drawerClose` | Close | বন্ধ করুন |
| `listings.auctionTimings` | Auction Timings | নিলামের সময়সীমা |
| `listings.startedAt` | Started: | শুরু: |
| `listings.endsAt` | Closes: | শেষ: |
| `listings.timeLeft` | Time left: | বাকি সময়: |
| `listings.pickupNote` | Pickup note: | হস্তান্তর নোট: |
| `listings.endingSoon` | Ending soon | শীঘ্রই শেষ হবে |
| `listings.hoursMinutesLeft` | {{hours}}h {{minutes}}m left | {{hours}} ঘণ্টা {{minutes}} মিনিট বাকি |
| `listings.minutesLeft` | {{minutes}}m left | {{minutes}} মিনিট বাকি |
| `listings.status.ACTIVE` | Active | চলমান |
| `listings.status.SOLD` | Sold | বিক্রি হয়েছে |
| `listings.status.EXPIRED_UNSOLD` | Expired | মেয়াদোত্তীর্ণ |
| `listings.status.CANCELLED` | Cancelled | বাতিল |
| `listings.status.DRAFT` | Draft | খসড়া |

---

## 3. Orders & Handover Lifecycle (অর্ডার ও পণ্য হস্তান্তর কার্যক্রম) (151 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `orders.pageTitle` | Orders | অর্ডার |
| `orders.pageSubtitle` | Manage incoming auction orders, confirm pickup schedules, and track deliveries. | নিলাম থেকে আসা অর্ডার পরিচালনা করুন, পণ্য হস্তান্তরের সময় নিশ্চিত করুন এবং বিতরণ ট্র্যাক করুন। |
| `orders.buyerPageTitle` | My Purchases & Orders | আমার ক্রয় ও অর্ডার |
| `orders.buyerPageSubtitle` | Track your won auction orders, manage demo payments, and confirm receipt after delivery. | নিলামে জেতা অর্ডারগুলো ট্র্যাক করুন, ডেমো পেমেন্ট পরিচালনা করুন এবং পণ্য বুঝে পাওয়ার পর নিশ্চিত করুন। |
| `orders.orderId` | Order | অর্ডার |
| `orders.quantity` | Quantity | পরিমাণ |
| `orders.unitPrice` | Price/kg | দর/কেজি |
| `orders.netEarnings` | Net payout | নিট আয় |
| `orders.kg` | kg | কেজি |
| `orders.viewDetails` | View details → | বিস্তারিত দেখুন → |
| `orders.autoCancelTimer` | Auto-cancels if not confirmed in: | নিশ্চিত না করলে স্বয়ংক্রিয় বাতিল হবে: |
| `orders.autoCancelTimerBuyer` | Farmer must confirm in: | কৃষককে নিশ্চিত করতে হবে: |
| `orders.autoCancelTimerDetail` | Confirmation deadline (order auto-cancels if unconfirmed): | নিশ্চিতকরণের সময়সীমা (নিশ্চিত না করলে বাতিল হয়ে যাবে): |
| `orders.autoCompleteTimer` | Auto-completes in: | স্বয়ংক্রিয় সম্পন্ন হবে: |
| `orders.autoCompleteTimerDetail` | Auto-completes and releases payment in: | স্বয়ংক্রিয় সম্পন্ন হয়ে অর্থ ছাড় হবে: |
| `orders.emptyTitle` | No orders in this status | এই স্ট্যাটাসে কোনো অর্ডার নেই |
| `orders.emptySubtitle` | When auctions close with winning bids, incoming orders will appear here. | নিলামে ক্রেতা বিজয়ী হলে নতুন অর্ডার এখানে প্রদর্শিত হবে। |
| `orders.buyerEmptySubtitle` | When you win auctions, your won lots will appear here ready for pickup and delivery. | নিলামে জিতলে আপনার কেনা লটগুলো এখানে দেখা যাবে। |
| `orders.browseMarketplace` | Browse Marketplace → | বাজার দেখুন → |
| `orders.exploreAuctions` | Explore Marketplace | বাজার ঘুরে দেখুন |
| `orders.backToOrders` | Back to Orders | অর্ডারে ফিরে যান |
| `orders.handoverScheduleTitle` | Scheduled Handover | নির্ধারিত হস্তান্তর |
| `orders.handoverAt` | Ready for pickup at | পণ্য গ্রহণের নির্ধারিত সময় |
| `orders.pickupInstructions` | Instructions | নির্দেশনা |
| `orders.fulfilmentMethod` | Method | হস্তান্তর পদ্ধতি |
| `orders.pendingPickupNotice` | The farmer will schedule the handover time and pickup instructions upon confirming the order. | অর্ডারটি নিশ্চিত করার সময় কৃষক পণ্য হস্তান্তরের সময় ও স্থান উল্লেখ করবেন। |
| `orders.notFoundTitle` | Order not found | অর্ডারটি পাওয়া যায়নি |
| `orders.financialSummary` | Financial Breakdown | আর্থিক বিবরণী |
| `orders.counterpartyTitle` | Buyer Details | ক্রেতার বিবরণ |
| `orders.activityTimeline` | Order Timeline | অর্ডারের সময়রেখা |
| `orders.availableActions` | Actions | পদক্ষেপ |
| `orders.status.PENDING` | Needs action | অপেক্ষমাণ |
| `orders.status.CONFIRMED` | In progress | চলমান |
| `orders.status.DELIVERED` | Delivered | বিতরণকৃত |
| `orders.status.COMPLETED` | Completed | সম্পন্ন |
| `orders.status.CANCELLED` | Cancelled | বাতিল |
| `orders.status.DISPUTED` | Disputed | আপত্তিজনক |
| `orders.tabs.label` | Order status tabs | অর্ডার স্ট্যাটাস ট্যাব |
| `orders.tabs.needsAction` | Needs action | পদক্ষেপ প্রয়োজন |
| `orders.tabs.inProgress` | In progress | চলমান |
| `orders.tabs.delivered` | Delivered | বিতরণকৃত |
| `orders.tabs.completed` | Completed | সম্পন্ন |
| `orders.tabs.disputed` | In dispute | বিরোধপূর্ণ |
| `orders.tabs.cancelled` | Cancelled | বাতিল |
| `orders.actions.confirm` | Confirm order | অর্ডার নিশ্চিত করুন |
| `orders.actions.confirming` | Confirming… | নিশ্চিত করা হচ্ছে… |
| `orders.actions.markDelivered` | Mark delivered | বিতরণ সম্পন্ন করুন |
| `orders.actions.delivering` | Delivering… | বিতরণ করা হচ্ছে… |
| `orders.actions.cancel` | Cancel order | অর্ডার বাতিল করুন |
| `orders.actions.payNow` | Pay now | এখনই পরিশোধ করুন |
| `orders.actions.confirmReceipt` | Confirm receipt | পণ্যপ্রাপ্তি নিশ্চিত করুন |
| `orders.actions.confirmingReceipt` | Confirming receipt… | নিশ্চিত করা হচ্ছে… |
| `orders.actions.reportProblem` | Report a problem | সমস্যা জানান |
| `orders.actions.reportingProblem` | Reporting… | পাঠানো হচ্ছে… |
| `orders.payment.dialogTitle` | Pay for Order | অর্ডারের মূল্য পরিশোধ |
| `orders.payment.title` | Payment Details | পেমেন্টের বিবরণ |
| `orders.payment.statusLabel` | Status | স্ট্যাটাস |
| `orders.payment.demoBadge` | Demo Payment | ডেমো পেমেন্ট |
| `orders.payment.amountDue` | Total Amount Due | মোট প্রদেয় মূল্য |
| `orders.payment.demoLabel` | Demo payment. No real money. | ডেমো পেমেন্ট। কোনো আসল টাকা নয়। |
| `orders.payment.demoNoticeTitle` | Demo payment. No real money. | ডেমো পেমেন্ট। কোনো আসল টাকা নয়। |
| `orders.payment.demoNoticeSubtitle` | Simulated wallet payment for testing auction order workflows. | অর্ডার টেস্ট করার জন্য কাল্পনিক ওয়ালেট পেমেন্ট। |
| `orders.payment.demoHelp` | You can simulate instant payment using test balance or pay on delivery. | আপনি পরীক্ষামূলক ওয়ালেট দিয়ে পরিশোধ করতে পারেন অথবা পণ্য পেয়ে নগদে পরিশোধ করতে পারেন। |
| `orders.payment.paidWallet` | Paid (Demo Wallet) | পরিশোধিত (ডেমো ওয়ালেট) |
| `orders.payment.paidCod` | Paid (COD) | পরিশোধিত (ক্যাশ অন ডেলিভারি) |
| `orders.payment.unpaid` | Pay on delivery / Unpaid | ক্যাশ অন ডেলিভারি / অপরিশোধিত |
| `orders.payment.methodWallet` | Simulated Wallet (Pay now) | কাল্পনিক ওয়ালেট (এখনই পরিশোধ) |
| `orders.payment.instantSim` | Instant | তাৎক্ষণিক |
| `orders.payment.walletDesc` | Instantly settle this order using simulated wallet balance. Demo payment. No real money. | কাল্পনিক ব্যালেন্স দিয়ে তাৎক্ষণিক পরিশোধ করুন। ডেমো পেমেন্ট। কোনো আসল টাকা নয়। |
| `orders.payment.methodCod` | Keep pay on delivery (Cash) | ক্যাশ অন ডেলিভারি রাখুন (নগদ) |
| `orders.payment.cashHandover` | At Handover | পণ্য গ্রহণের সময় |
| `orders.payment.codDesc` | Pay cash in hand directly to the farmer when picking up the produce. | পণ্য গ্রহণের সময় সরাসরি কৃষককে নগদ টাকা পরিশোধ করুন। |
| `orders.payment.closeButton` | Close | বন্ধ করুন |
| `orders.payment.payNowButton` | Pay Now (Demo Wallet) | এখনই পরিশোধ করুন (ডেমো ওয়ালেট) |
| `orders.payment.keepCodButton` | Keep Pay on Delivery | ক্যাশ অন ডেলিভারি রাখুন |
| `orders.payment.processing` | Processing payment… | পেমেন্ট সম্পন্ন হচ্ছে… |
| `orders.money.unitPrice` | Price per kg | প্রতি কেজি দর |
| `orders.money.quantity` | Quantity | পরিমাণ |
| `orders.money.subtotal` | Subtotal | উপমোট |
| `orders.money.platformFee` | Platform fee | প্ল্যাটফর্ম ফি |
| `orders.money.netPayout` | Net payout | নিট প্রাপ্তি |
| `orders.money.totalDue` | Total amount | মোট প্রদেয় |
| `orders.counterparty.farmerInfo` | Farmer Information | কৃষকের তথ্য |
| `orders.counterparty.buyerInfo` | Buyer Information | ক্রেতার তথ্য |
| `orders.counterparty.contactMaskedBadge` | Contact hidden | যোগাযোগ লুকানো |
| `orders.counterparty.contactRevealedBadge` | Contact verified | যোগাযোগ প্রকাশ করা হয়েছে |
| `orders.counterparty.region` | Region | অঞ্চল |
| `orders.counterparty.location` | Location | ঠিকানা |
| `orders.counterparty.maskedNotice` | Phone number and full pickup address will be revealed once you confirm this order. | অর্ডারটি নিশ্চিত করার পর ফোন নম্বর এবং সম্পূর্ণ ঠিকানা প্রকাশিত হবে। |
| `orders.timeline.empty` | No activity recorded yet. | এখনও কোনো কার্যকলাপ নেই। |
| `orders.confirm.title` | Confirm Order & Set Handover | অর্ডার নিশ্চিতকরণ ও হস্তান্তর নির্ধারণ |
| `orders.confirm.description` | Set the estimated handover time when produce will be ready for buyer pickup. Must be within 72 hours. | ক্রেতার পণ্য গ্রহণের আনুমানিক সময় নির্ধারণ করুন। অবশ্যই আগামী ৭২ ঘণ্টার মধ্যে হতে হবে। |
| `orders.confirm.timeRequired` | Please choose a handover date and time. | হস্তান্তরের তারিখ ও সময় নির্বাচন করুন। |
| `orders.confirm.timeInvalid` | Invalid date format. | তারিখের ফরম্যাট সঠিক নয়। |
| `orders.confirm.timePast` | Handover time must be in the future. | হস্তান্তরের সময় ভবিষ্যতের হতে হবে। |
| `orders.confirm.timeMax72h` | Handover time must be within 72 hours from now. | হস্তান্তরের সময় আগামী ৭২ ঘণ্টার মধ্যে হতে হবে। |
| `orders.confirm.noteTooLong` | Note must not exceed 200 characters. | নোট ২০০ অক্ষরের বেশি হতে পারবে না। |
| `orders.confirm.handoverTimeLabel` | Handover Date & Time * (Within 72 hours) | হস্তান্তরের তারিখ ও সময় * (৭২ ঘণ্টার মধ্যে) |
| `orders.confirm.pickupNoteLabel` | Pickup Note / Instructions (Optional, max 200 chars) | পণ্য গ্রহণের নির্দেশনা (ঐচ্ছিক, সর্বোচ্চ ২০০ অক্ষর) |
| `orders.confirm.notePlaceholder` | e.g. Call 1 hour before arriving at farm gate. | যেমন: খামারে পৌঁছানোর ১ ঘণ্টা আগে ফোন দিন। |
| `orders.confirm.cancelButton` | Close | বন্ধ করুন |
| `orders.confirm.submitButton` | Confirm Order | অর্ডার নিশ্চিত করুন |
| `orders.confirm.submitting` | Confirming… | নিশ্চিত করা হচ্ছে… |
| `orders.cancel.title` | Cancel Order | অর্ডার বাতিল |
| `orders.cancel.description` | Cancelling an order releases the commitment. Please provide a clear reason. | অর্ডার বাতিল করলে দায়মুক্তি ঘটবে। অনুগ্রহ করে স্পষ্ট কারণ উল্লেখ করুন। |
| `orders.cancel.buyerReliabilityWarning` | Note: Cancelling an order after winning the auction is recorded on your profile and affects your buyer reliability score. | সতর্কতা: নিলামে বিজয়ী হওয়ার পর অর্ডার বাতিল করলে তা প্রোফাইলে রেকর্ড থাকবে এবং ক্রেতার নির্ভরযোগ্যতা রেটিং কমবে। |
| `orders.cancel.reasonRequired` | Please choose a reason for cancellation. | বাতিলের কারণ নির্বাচন করুন। |
| `orders.cancel.noteTooLong` | Note must not exceed 200 characters. | নোট ২০০ অক্ষরের বেশি হতে পারবে না। |
| `orders.cancel.reasonLabel` | Reason for Cancellation * | বাতিলের কারণ * |
| `orders.cancel.noteLabel` | Explanation / Note (Optional, max 200 chars) | ব্যাখ্যা বা মন্তব্য (ঐচ্ছিক, সর্বোচ্চ ২০০ অক্ষর) |
| `orders.cancel.notePlaceholder` | Provide details about why the order cannot be fulfilled. | কেন অর্ডার সম্পন্ন করা সম্ভব হচ্ছে না তা লিখুন। |
| `orders.cancel.closeButton` | Keep Order | অর্ডার রাখুন |
| `orders.cancel.submitButton` | Confirm Cancellation | বাতিল নিশ্চিত করুন |
| `orders.cancel.submitting` | Cancelling… | বাতিল করা হচ্ছে… |
| `orders.cancelReason.FARMER_CROP_DAMAGED` | Crop was damaged after listing | লিস্টিংয়ের পর ফসল ক্ষতিগ্রস্ত হয়েছে |
| `orders.cancelReason.FARMER_UNABLE_TO_FULFILL` | Unable to fulfill agreed quantity | নির্দিষ্ট পরিমাণ সরবরাহ করতে অসমর্থ |
| `orders.cancelReason.FARMER_COMMUNICATION_FAILED` | Buyer could not be reached | ক্রেতার সাথে যোগাযোগ করা যায়নি |
| `orders.cancelReason.BUYER_CHANGE_OF_MIND` | Changed my mind | মন পরিবর্তন হয়েছে |
| `orders.cancelReason.BUYER_CANNOT_COLLECT` | Cannot arrange pickup or transportation | পরিবহন বা সংগ্রহের ব্যবস্থা করা যাচ্ছে না |
| `orders.cancelReason.BUYER_COMMUNICATION_FAILED` | Unable to reach the farmer | কৃষকের সাথে যোগাযোগ করা সম্ভব হয়নি |
| `orders.cancelReason.CONFIRMATION_TIMEOUT` | Confirmation timed out | নিশ্চিতকরণের সময় শেষ হয়েছে |
| `orders.cancelReason.MUTUAL_AGREEMENT` | Mutual agreement with counterparty | পারস্পরিক সম্মতি |
| `orders.cancelReason.OTHER` | Other reason | অন্যান্য কারণ |
| `orders.stockReturn.promptTitle` | Add this stock back to your inventory? | এই পণ্যটি কি আপনার মজুতে পুনরায় যুক্ত করবেন? |
| `orders.stockReturn.promptDescription` | Since this order was cancelled, select 'Yes' to return the quantity back to your available inventory so you can relist it, or 'No' if produce is damaged or sold elsewhere. | অর্ডারটি বাতিল হওয়ায়, পরিমাণটি পুনরায় মজুতে ফেরত এনে আবার বিক্রি করতে 'হ্যাঁ' চাপুন, অথবা পণ্য নষ্ট হলে বা অন্যত্র বিক্রি হলে 'না' চাপুন। |
| `orders.stockReturn.yes` | Yes, add back | হ্যাঁ, মজুতে যোগ করুন |
| `orders.stockReturn.no` | No, do not add | না, যোগ করবেন না |
| `orders.stockReturn.saving` | Saving… | সংরক্ষণ করা হচ্ছে… |
| `orders.stockReturn.returnedBadge` | Stock returned to your available inventory | পণ্যটি আপনার উপলব্ধ মজুতে ফেরত নেওয়া হয়েছে |
| `orders.stockReturn.discardedBadge` | Stock marked as discarded / sold locally | পণ্যটি বাতিল বা স্থানীয়ভাবে বিক্রি হিসেবে চিহ্নিত |
| `orders.dispute.dialogTitle` | Report a problem | সমস্যা জানান |
| `orders.dispute.dialogDescription` | Report an issue with the delivered produce within 24 hours. Auto-completion will be paused while the issue is reviewed. | পণ্য গ্রহণের ২৪ ঘণ্টার মধ্যে যেকোনো সমস্যা জানান। অভিযোগ পর্যালোচনাকালে স্বয়ংক্রিয় সমাপ্তি স্থগিত থাকবে। |
| `orders.dispute.snapshotHelp` | The original AI quality grading and listing snapshots will be preserved for investigation. | তদন্তের সুবিধার জন্য লিস্টিংয়ের মূল এআই মান এবং গ্রেড রেকর্ড সংরক্ষিত রাখা হবে। |
| `orders.dispute.reasonRequired` | Please choose a reason for the problem. | সমস্যার কারণ নির্বাচন করুন। |
| `orders.dispute.noteTooLong` | Note must not exceed 200 characters. | নোট ২০০ অক্ষরের বেশি হতে পারবে না। |
| `orders.dispute.reasonLabel` | Reason for report * | সমস্যার কারণ * |
| `orders.dispute.noteLabel` | Additional Details (optional, max 200 chars) | বিস্তারিত বিবরণ (ঐচ্ছিক, সর্বোচ্চ ২০০ অক্ষর) |
| `orders.dispute.notePlaceholder` | Describe the difference in quality, missing quantity, or produce condition… | মানের অমিল, ওজনের কমতি বা পণ্যের অবস্থা সম্পর্কে লিখুন… |
| `orders.dispute.submitReport` | Submit Problem Report | অভিযোগ জমা দিন |
| `orders.dispute.submitting` | Submitting… | পাঠানো হচ্ছে… |
| `orders.dispute.inDisputeTitle` | Order In Dispute | অর্ডারটি বিরোধপূর্ণ অবস্থায় রয়েছে |
| `orders.dispute.inDisputeBuyerNotice` | You have reported a problem with this delivery. The order is paused and will not auto-complete pending resolution. | আপনি এই ডেলিভারি নিয়ে অভিযোগ জানিয়েছেন। পর্যালোচনার নিষ্পত্তি না হওয়া পর্যন্ত অর্ডারটি স্বয়ংক্রিয়ভাবে সম্পন্ন হবে না। |
| `orders.dispute.inDisputeFarmerNotice` | The buyer has reported an issue with this order. Payout is on hold pending resolution. | ক্রেতা এই অর্ডার নিয়ে অভিযোগ জানিয়েছেন। বিরোধ মীমাংসা না হওয়া পর্যন্ত পাওনা স্থগিত থাকবে। |
| `orders.dispute.reasons.GRADE_LOWER_THAN_LISTED` | Grade lower than listed | লিস্টিংয়ের চেয়ে নিম্ন গ্রেড |
| `orders.dispute.reasons.QUANTITY_SHORT` | Quantity is short | ওজন বা পরিমাণ কম |
| `orders.dispute.reasons.SPOILED` | Produce spoiled or damaged | পণ্য পচা বা নষ্ট |
| `orders.dispute.reasons.OTHER` | Other problem | অন্যান্য সমস্যা |
| `orders.dispute.reasons.GRADE_MISMATCH` | Grade mismatch | গ্রেডের অমিল |
| `orders.dispute.reasons.WEIGHT_SHORTAGE` | Weight shortage | ওজনের ঘাটতি |
| `orders.dispute.reasons.DAMAGED_PRODUCE` | Damaged produce | নষ্ট পণ্য |
| `orders.dispute.reasons.WRONG_CROP` | Wrong crop | ভুল ফসল |

---

## 4. Warnings & Form Validations (সতর্কবার্তা ও তথ্য যাচাই) (21 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `errors.CONFLICT` | An account with this phone number already exists. | এই নম্বরে ইতিমধ্যে একটি অ্যাকাউন্ট আছে। |
| `errors.RATE_LIMITED` | Too many attempts. Please wait a moment and try again. | অনেকবার চেষ্টা হয়েছে। একটু অপেক্ষা করে আবার চেষ্টা করুন। |
| `errors.VALIDATION_ERROR` | Please check your details and try again. | তথ্য যাচাই করে আবার চেষ্টা করুন। |
| `errors.UNAUTHENTICATED` | Your session has ended. Please log in again. | আপনার সেশনের মেয়াদ শেষ। আবার লগ ইন করুন। |
| `errors.INVALID_CREDENTIALS` | Invalid phone number or password. Check your details and try again. | ফোন নম্বর বা পাসওয়ার্ড সঠিক নয়। তথ্য যাচাই করে আবার চেষ্টা করুন। |
| `errors.NETWORK_ERROR` | We could not reach BazarBeat. Check your connection and try again. | বাজারবিটে সংযোগ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন। |
| `errors.INVALID_PHONE` | Enter a valid Bangladesh mobile number. | সঠিক বাংলাদেশি মোবাইল নম্বর দিন। |
| `errors.INVALID_FORM` | Please check the required fields and password rules. | প্রয়োজনীয় তথ্য ও পাসওয়ার্ডের নিয়ম যাচাই করুন। |
| `errors.INTERNAL` | BazarBeat could not complete that request. Please try again shortly. | বাজারবিট অনুরোধটি সম্পন্ন করতে পারেনি। কিছুক্ষণ পর আবার চেষ্টা করুন। |
| `errors.API_ERROR` | BazarBeat could not complete that request. Please try again. | বাজারবিট অনুরোধটি সম্পন্ন করতে পারেনি। আবার চেষ্টা করুন। |
| `validation.checkFields` | Please fix the highlighted fields and try again. | চিহ্নিত ঘরগুলো ঠিক করে আবার চেষ্টা করুন। |
| `validation.passwordCommon` | This password is too common. Choose a less predictable password. | এই পাসওয়ার্ডটি খুব সহজ। অনুমান করা কঠিন এমন পাসওয়ার্ড দিন। |
| `validation.passwordMin` | Use at least 8 characters. | কমপক্ষে ৮ অক্ষর ব্যবহার করুন। |
| `validation.passwordMax` | Use no more than 128 characters. | সর্বোচ্চ ১২৮ অক্ষর ব্যবহার করুন। |
| `validation.phoneInvalid` | Enter a valid Bangladesh mobile number, such as 01712345678. | সঠিক বাংলাদেশি মোবাইল নম্বর দিন, যেমন 01712345678। |
| `validation.nameRequired` | Enter your name. | আপনার নাম লিখুন। |
| `validation.nameMax` | Use no more than 100 characters. | সর্বোচ্চ ১০০ অক্ষর ব্যবহার করুন। |
| `validation.locationRequired` | Choose a division and a district. | বিভাগ ও জেলা নির্বাচন করুন। |
| `validation.organizationInvalid` | Organization must be between 1 and 160 characters. | প্রতিষ্ঠানের নাম ১ থেকে ১৬০ অক্ষরের মধ্যে হতে হবে। |
| `validation.upazilaInvalid` | If provided, upazila must be between 1 and 100 characters. | উপজেলা দিলে ১ থেকে ১০০ অক্ষরের মধ্যে হতে হবে। |
| `validation.fieldInvalid` | Check this field and try again. | এই ঘরটি যাচাই করে আবার চেষ্টা করুন। |

---

## 5. API Errors & System Codes (সিস্টেম এরর ও স্ট্যাটাস কোড) (30 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `apiErrors.DEFAULT` | An unexpected error occurred. Please try again. | একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। |
| `apiErrors.VALIDATION_ERROR` | Validation error. Please check your inputs. | যাচাইকরণে ত্রুটি। অনুগ্রহ করে সঠিক তথ্য দিন। |
| `apiErrors.UNAUTHORIZED` | You are not signed in. Please log in to continue. | আপনার সেশন সক্রিয় নেই। অনুগ্রহ করে আবার লগ ইন করুন। |
| `apiErrors.FORBIDDEN` | You do not have permission to perform this action. | এই কাজটি করার অনুমতি আপনার নেই। |
| `apiErrors.NOT_FOUND` | The requested resource could not be found. | অনুরোধকৃত তথ্য খুঁজে পাওয়া যায়নি। |
| `apiErrors.CONFLICT` | A conflicting action has already occurred. | অনুরোধকৃত কাজটি ইতিমধ্যে অন্য কেউ সম্পাদন করেছে। |
| `apiErrors.RATE_LIMITED` | Too many requests. Please slow down. | একসাথে অনেক অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন। |
| `apiErrors.INTERNAL_SERVER_ERROR` | Server encountered an error. Please try again later. | সার্ভারে সমস্যা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন। |
| `apiErrors.OWN_LISTING` | You cannot place a bid on your own listing. | আপনি নিজের পণ্যে ডাক বা বিড দিতে পারবেন না। |
| `apiErrors.AUCTION_CLOSED` | This auction has ended and is no longer accepting bids. | এই নিলামের সময় শেষ হয়ে গেছে এবং আর কোনো ডাক গ্রহণ করা হচ্ছে না। |
| `apiErrors.AUCTION_NOT_EXPIRED` | This auction is still active and cannot be closed early. | এই নিলামটি এখনও চলমান রয়েছে। |
| `apiErrors.BID_TOO_LOW` | Your bid is below the minimum required amount. | আপনার ডাক ন্যূনতম প্রয়োজনীয় মূল্যের চেয়ে কম। |
| `apiErrors.CANNOT_OUTBID_SELF` | You are already the highest bidder. | আপনি ইতিমধ্যে সর্বোচ্চ দরদাতা হিসেবে এগিয়ে আছেন। |
| `apiErrors.HAS_BIDS` | This listing has received bids and cannot be cancelled. | এই লিস্টিংয়ে ডাক জমা পড়েছে, তাই এটি বাতিল করা যাবে না। |
| `apiErrors.NO_BIDS` | No bids have been placed on this listing. | এই লিস্টিংয়ে কোনো ডাক জমা পড়েনি। |
| `apiErrors.BELOW_FLOOR` | Your bid cannot be lower than the floor price. | আপনার ডাক ন্যূনতম ফ্লোর প্রাইসের চেয়ে কম হতে পারে না। |
| `apiErrors.INVALID_TRANSITION` | Invalid status transition for this listing. | লিস্টিংয়ের এই অবস্থা পরিবর্তন সম্ভব নয়। |
| `apiErrors.GRADE_STALE` | Produce shelf-life has elapsed. Re-grading is required. | ফসলের সতেজতার মেয়াদ অতিক্রান্ত হয়েছে। নতুন করে মান যাচাই প্রয়োজন। |
| `apiErrors.COMPARE_MIXED_CROPS` | Cannot compare listings of different crop types. | ভিন্ন ধরনের ফসলের লিস্টিং তুলনা করা সম্ভব নয়। |
| `apiErrors.WATCHLIST_CAP_EXCEEDED` | Watchlist limit reached (maximum 50 items). | পছন্দের তালিকার সর্বোচ্চ সীমা পৌঁছেছে (সর্বোচ্চ ৫০টি)। |
| `apiErrors.LISTING_NOT_ACTIVE` | Only active listings can be saved to the watchlist. | শুধুমাত্র সক্রিয় লিস্টিং পছন্দের তালিকায় যোগ করা যাবে। |
| `apiErrors.INSUFFICIENT_STOCK` | Insufficient inventory stock to complete this listing. | লিস্টিংটি তৈরি করার জন্য পর্যাপ্ত মজুত নেই। |
| `apiErrors.ORDER_NOT_FOUND` | Order not found. | অর্ডার খুঁজে পাওয়া যায়নি। |
| `apiErrors.INVALID_ORDER_TRANSITION` | Invalid order status transition. | অর্ডারের এই অবস্থা পরিবর্তন সম্ভব নয়। |
| `apiErrors.ORDER_ACTION_NOT_ALLOWED` | You are not authorized to perform this order action. | এই কাজটি করার অনুমতি আপনার নেই। |
| `apiErrors.ORDER_ALREADY_PAID` | This order has already been paid. | এই অর্ডারের মূল্য ইতিমধ্যে পরিশোধ করা হয়েছে। |
| `apiErrors.HANDOVER_TIME_INVALID` | Handover schedule must be in the future (within 72 hours). | হস্তান্তরের সময় অবশ্যই পরবর্তী ৭২ ঘণ্টার মধ্যে হতে হবে। |
| `apiErrors.DISPUTE_WINDOW_EXPIRED` | The 24-hour dispute window has expired. | ২৪ ঘণ্টার বিরোধ নিষ্পত্তির সময়সীমা অতিক্রান্ত হয়েছে। |
| `apiErrors.CROP_MISMATCH` | Uploaded photo does not match the selected crop. | আপলোড করা ছবি নির্বাচিত ফসলের সাথে মিলছে না। |
| `apiErrors.GRADE_UNAVAILABLE` | Quality grade could not be determined from the images. | ছবি থেকে ফসলের গুণমান নির্ধারণ করা যায়নি। |

---

## 6. Real-time Notifications & Bell (রিয়েল-টাইম বিজ্ঞপ্তি ও অ্যালার্ট) (38 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `notifications.title` | Notifications | বিজ্ঞপ্তি |
| `notifications.markAllRead` | Mark all as read | সব পঠিত চিহ্নিত করুন |
| `notifications.viewAll` | View all notifications | সব বিজ্ঞপ্তি দেখুন |
| `notifications.allTab` | All | সব |
| `notifications.unreadTab` | Unread | অপঠিত |
| `notifications.emptyAll` | No notifications yet | এখনও কোনো বিজ্ঞপ্তি নেই |
| `notifications.emptyUnread` | No unread notifications | কোনো অপঠিত বিজ্ঞপ্তি নেই |
| `notifications.dismiss` | Dismiss | বাতিল করুন |
| `notifications.loading` | Loading notifications... | বিজ্ঞপ্তি লোড হচ্ছে... |
| `notifications.retry` | Retry | পুনরায় চেষ্টা করুন |
| `notifications.types.NEW_BID.title` | New bid on {{crop}} | {{crop}}-এ নতুন বিড |
| `notifications.types.NEW_BID.body` | Current bid is {{amount}} per kg with {{count}} bids. | বর্তমান বিড কেজি প্রতি {{amount}}, মোট বিড {{count}}টি। |
| `notifications.types.OUTBID.title` | You were outbid on {{crop}} | {{crop}}-এ আপনার বিড ছাড়িয়ে গেছে |
| `notifications.types.OUTBID.body` | A new bid of {{amount}} per kg was placed. | কেজি প্রতি {{amount}} মূল্যে নতুন বিড দেওয়া হয়েছে। |
| `notifications.types.AUCTION_SOLD.title` | Auction sold! {{crop}} | নিলাম সম্পন্ন! {{crop}} |
| `notifications.types.AUCTION_SOLD.body` | Your listing sold for {{amount}} per kg. Total: {{total}}. | আপনার ফসল কেজি প্রতি {{amount}} মূল্যে বিক্রি হয়েছে। মোট: {{total}}। |
| `notifications.types.AUCTION_WON.title` | You won the auction! {{crop}} | আপনি নিলাম জিতেছেন! {{crop}} |
| `notifications.types.AUCTION_WON.body` | You won {{crop}} at {{amount}} per kg. Please proceed to payment. | কেজি প্রতি {{amount}} মূল্যে আপনি {{crop}} জিতেছেন। অনুগ্রহ করে পেমেন্ট করুন। |
| `notifications.types.AUCTION_LOST.title` | Auction ended for {{crop}} | {{crop}}-এর নিলাম সমাপ্ত হয়েছে |
| `notifications.types.AUCTION_LOST.body` | The auction closed at {{amount}} per kg. | নিলাম কেজি প্রতি {{amount}} মূল্যে সমাপ্ত হয়েছে। |
| `notifications.types.AUCTION_UNSOLD.title` | Auction ended without bids: {{crop}} | কোনো বিড ছাড়াই নিলাম সমাপ্ত: {{crop}} |
| `notifications.types.AUCTION_UNSOLD.body` | Your listing ended unsold. Consider lowering the floor price and relisting. | আপনার লটটি অবিক্রিত রয়েছে। ফ্লোর মূল্য কমিয়ে পুনরায় তালিকাভুক্ত করতে পারেন। |
| `notifications.types.ENDING_SOON.title` | Auction ending soon for {{crop}} | {{crop}}-এর নিলাম শীঘ্রই শেষ হচ্ছে |
| `notifications.types.ENDING_SOON.body` | Auction for {{crop}} ends soon. Check it now! | {{crop}}-এর নিলামের সময় প্রায় শেষ। এখনই যাচাই করুন! |
| `notifications.types.ORDER_UPDATE.CREATED.title` | Order created for {{crop}} | {{crop}}-এর জন্য নতুন অর্ডার |
| `notifications.types.ORDER_UPDATE.CREATED.body` | A buyer purchased your lot. Please confirm the handover schedule. | একজন ক্রেতা আপনার লট কিনেছেন। অনুগ্রহ করে হ্যান্ডওভারের সময় নিশ্চিত করুন। |
| `notifications.types.ORDER_UPDATE.CONFIRMED.title` | Order confirmed for {{crop}} | {{crop}}-এর অর্ডার নিশ্চিত হয়েছে |
| `notifications.types.ORDER_UPDATE.CONFIRMED.body` | Farmer confirmed the order. Please make payment to proceed. | কৃষক অর্ডার নিশ্চিত করেছেন। অনুগ্রহ করে পেমেন্ট করুন। |
| `notifications.types.ORDER_UPDATE.PAID.title` | Payment received for {{crop}} | {{crop}}-এর পেমেন্ট সম্পন্ন হয়েছে |
| `notifications.types.ORDER_UPDATE.PAID.body` | Buyer has paid. Please prepare for pickup/delivery. | ক্রেতা পেমেন্ট পরিশোধ করেছেন। ফসল সরবরাহের জন্য প্রস্তুত করুন। |
| `notifications.types.ORDER_UPDATE.DELIVERED.title` | Order delivered for {{crop}} | {{crop}} সরবরাহ করা হয়েছে |
| `notifications.types.ORDER_UPDATE.DELIVERED.body` | Goods delivered. Please verify and confirm receipt. | পণ্য সরবরাহ হয়েছে। যাচাই করে ডেলিভারি নিশ্চিত করুন। |
| `notifications.types.ORDER_UPDATE.COMPLETED.title` | Order completed for {{crop}} | {{crop}}-এর অর্ডার সফলভাবে সম্পন্ন হয়েছে |
| `notifications.types.ORDER_UPDATE.COMPLETED.body` | Order has been successfully completed and settled. | অর্ডারটি সফলভাবে সম্পন্ন হয়েছে। |
| `notifications.types.ORDER_UPDATE.CANCELLED.title` | Order cancelled for {{crop}} | {{crop}}-এর অর্ডার বাতিল করা হয়েছে |
| `notifications.types.ORDER_UPDATE.CANCELLED.body` | The order has been cancelled. | অর্ডারটি বাতিল করা হয়েছে। |
| `notifications.types.ORDER_UPDATE.DISPUTED.title` | Problem reported on order for {{crop}} | {{crop}}-এর অর্ডারে সমস্যা রিপোর্ট করা হয়েছে |
| `notifications.types.ORDER_UPDATE.DISPUTED.body` | A dispute was opened for this order. | এই অর্ডারের জন্য একটি সমস্যা রিপোর্ট করা হয়েছে। |

---

## 7. Marketplace, Detail, Compare & Watchlist (মার্কেটপ্লেস, বিস্তারিত, তুলনা ও পছন্দের তালিকা) (166 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `watchlist.title` | Watchlist | পছন্দের তালিকা |
| `watchlist.subtitle` | Track saved auctions and monitor auctions ending soon. | সংরক্ষিত নিলাম ও সমাপ্তির সতর্কবার্তা পর্যবেক্ষণ করুন। |
| `watchlist.watch` | Watch | তালিকায় রাখুন |
| `watchlist.watching` | Watching | তালিকায় আছে |
| `watchlist.addToWatchlist` | Add to watchlist | পছন্দের তালিকায় যুক্ত করুন |
| `watchlist.removeFromWatchlist` | Remove from watchlist | পছন্দের তালিকা থেকে মুছুন |
| `watchlist.capExceeded` | Watchlist limit reached (maximum 50 items) | পছন্দের তালিকার সর্বোচ্চ সীমা পৌঁছেছে (সর্বোচ্চ ৫০টি) |
| `watchlist.listingNotActive` | Only active listings can be saved | শুধুমাত্র সক্রিয় লিস্টিং তালিকায় যুক্ত করা যাবে |
| `watchlist.toggleError` | Could not update watchlist | পছন্দের তালিকা আপডেট করা যায়নি |
| `watchlist.emptyTitle` | Your watchlist is empty | আপনার পছন্দের তালিকা খালি |
| `watchlist.emptyDescription` | Save active listings from the marketplace to keep track of auctions ending soon. | শীঘ্রই শেষ হতে যাওয়া নিলাম ট্র্যাক করতে বাজার থেকে সক্রিয় লিস্টিং সংরক্ষণ করুন। |
| `watchlist.browseMarketplace` | Browse Marketplace | মার্কেটপ্লেস দেখুন |
| `watchlist.endedSold` | Sold for {{price}} / kg | {{price}} / কেজিতে বিক্রি হয়েছে |
| `watchlist.endedUnsold` | Ended without sale | বিক্রি ছাড়া সমাপ্ত |
| `watchlist.endedCancelled` | Cancelled | বাতিল হয়েছে |
| `watchlist.viewDetails` | View Details | বিবরণ দেখুন |
| `watchlist.remove` | Remove | মুছুন |
| `watchlist.loading` | Loading watchlist... | পছন্দের তালিকা লোড হচ্ছে... |
| `watchlist.error` | Failed to load watchlist | পছন্দের তালিকা লোড করা যায়নি |
| `watchlist.retry` | Retry | পুনরায় চেষ্টা করুন |
| `watchlist.watchingChip` | Watching | সংরক্ষিত |
| `marketplace.title` | Produce Marketplace | কৃষি বাজার |
| `marketplace.subtitle` | Browse nationwide farmer auctions with verified AI quality grading and live bidding. | যাচাইকৃত এআই কোয়ালিটি গ্রেডিং ও সরাসরি নিলামসহ দেশব্যাপী কৃষকদের তালিকা ব্রাউজ করুন। |
| `marketplace.demoAiChip` | Demo AI model | ডেমো এআই মডেল |
| `marketplace.demoAiTooltip` | Produce quality and price benchmarks are evaluated by BazarBeat AI. | বাজারবিটের এআই দ্বারা পণ্যের মান ও দামের নির্দেশিকা নির্ধারিত। |
| `marketplace.searchFilters` | Filters | ফিল্টার |
| `marketplace.filterCount` | {{count}} active | {{count}}টি সক্রিয় |
| `marketplace.clearFilters` | Clear filters | ফিল্টার মুছুন |
| `marketplace.applyFilters` | Apply filters | ফিল্টার প্রয়োগ করুন |
| `marketplace.noFiltersActive` | No filters active | কোনো ফিল্টার নেই |
| `marketplace.allCrops` | All crops | সব ফসল |
| `marketplace.crop` | Crop | ফসল |
| `marketplace.allGrades` | All grades | সব গ্রেড |
| `marketplace.grade` | Grade | গ্রেড |
| `marketplace.allDivisions` | All divisions | সব বিভাগ |
| `marketplace.division` | Division | বিভাগ |
| `marketplace.allDistricts` | All districts | সব জেলা |
| `marketplace.district` | District | জেলা |
| `marketplace.selectDivisionFirst` | Select division first | প্রথমে বিভাগ নির্বাচন করুন |
| `marketplace.priceRange` | Price (৳/kg) | দর (৳/কেজি) |
| `marketplace.minPrice` | Min ৳ | সর্বনিম্ন ৳ |
| `marketplace.maxPrice` | Max ৳ | সর্বোচ্চ ৳ |
| `marketplace.minQuantity` | Min Quantity (kg) | সর্বনিম্ন পরিমাণ (কেজি) |
| `marketplace.endingWithin` | Ending within | মেয়াদ শেষ হবে |
| `marketplace.anyTime` | Any time | যেকোনো সময় |
| `marketplace.hoursPreset` | {{hours}}h | {{hours}} ঘণ্টা |
| `marketplace.hours1` | 1 hour | ১ ঘণ্টা |
| `marketplace.hours3` | 3 hours | ৩ ঘণ্টা |
| `marketplace.hours6` | 6 hours | ৬ ঘণ্টা |
| `marketplace.hours24` | 24 hours | ২৪ ঘণ্টা |
| `marketplace.sort` | Sort by | ক্রম সাজান |
| `marketplace.sortEndingSoonest` | Ending soonest | আগে শেষ হবে |
| `marketplace.sortLowestPrice` | Lowest price | সর্বনিম্ন দর |
| `marketplace.sortHighestGrade` | Highest grade | সর্বোচ্চ গ্রেড |
| `marketplace.sortNewest` | Newest | নতুন তালিকা |
| `marketplace.resultsCount_zero` | 0 listings found | কোনো তালিকা পাওয়া যায়নি |
| `marketplace.resultsCount_one` | 1 listing found | ১টি তালিকা পাওয়া গেছে |
| `marketplace.resultsCount_other` | {{count}} listings found | {{count}}টি তালিকা পাওয়া গেছে |
| `marketplace.showingResults` | Showing {{start}}-{{end}} of {{total}} listings | {{total}}টির মধ্যে {{start}}-{{end}} দেখানো হচ্ছে |
| `marketplace.emptyTitle` | No listings found | কোনো তালিকা পাওয়া যায়নি |
| `marketplace.emptySubtitle` | Try adjusting or clearing your filters to discover more produce auctions. | আরও নিলাম দেখতে ফিল্টার সমন্বয় করুন অথবা ফিল্টার মুছুন। |
| `marketplace.errorTitle` | Could not load marketplace listings | বাজারের তথ্য লোড করা যায়নি |
| `marketplace.errorSubtitle` | Check your internet connection and try again. | ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন। |
| `marketplace.retry` | Try again | আবার চেষ্টা করুন |
| `marketplace.paginationPrev` | Previous | আগের |
| `marketplace.paginationNext` | Next | পরের |
| `marketplace.pageIndicator` | Page {{page}} of {{totalPages}} | পৃষ্ঠা {{page}} / {{totalPages}} |
| `marketplace.addToCompare` | Add to compare | তুলনায় যোগ করুন |
| `marketplace.addedToCompare` | Added to compare | তুলনায় যোগ করা হয়েছে |
| `marketplace.compareLimitReached` | Maximum 4 listings can be compared at once | একসাথে সর্বোচ্চ ৪টি তালিকা তুলনা করা যায় |
| `marketplace.compareCropMismatch` | Compare is limited to listings of the same crop ({{crop}}) | শুধুমাত্র একই ফসলের তালিকা তুলনা করা যায় ({{crop}}) |
| `marketplace.noBidsYet` | No bids yet | এখনো কোনো বিড নেই |
| `marketplace.bidsCount_zero` | No bids yet | এখনো কোনো বিড নেই |
| `marketplace.bidsCount_one` | 1 bid | ১টি বিড |
| `marketplace.bidsCount_other` | {{count}} bids | {{count}}টি বিড |
| `marketplace.floorPrice` | Floor: | সর্বনিম্ন: |
| `marketplace.currentBid` | Current: | বর্তমান: |
| `marketplace.compareTray.title` | Compare Produce | ফসলের তুলনা |
| `marketplace.compareTray.selectedCount` | {{count}} of 4 selected | ৪টির মধ্যে {{count}}টি নির্বাচিত |
| `marketplace.compareTray.cropLabel` | Comparing {{crop}} | {{crop}} তুলনা করা হচ্ছে |
| `marketplace.compareTray.clearAll` | Clear all | সব মুছুন |
| `marketplace.compareTray.compareButton` | Compare ({{count}}) | তুলনা করুন ({{count}}) |
| `marketplace.compareTray.minItemsHint` | Select at least 2 listings to compare | তুলনা করতে কমপক্ষে ২টি তালিকা বাছুন |
| `marketplace.compareTray.removeItem` | Remove {{title}} from compare | তুলনা থেকে {{title}} সরান |
| `listingDetail.backToMarketplace` | Back to marketplace | বাজারে ফিরে যান |
| `listingDetail.loading` | Loading produce details… | ফসলের বিস্তারিত লোড হচ্ছে… |
| `listingDetail.errorTitle` | Could not load listing | তালিকা লোড করা যায়নি |
| `listingDetail.errorSubtitle` | Check your internet connection and try again. | ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন। |
| `listingDetail.retry` | Try again | আবার চেষ্টা করুন |
| `listingDetail.photoGallery` | Photo Gallery | ছবির গ্যালারি |
| `listingDetail.aiAssessed` | AI-assessed | এআই-মূল্যায়িত |
| `listingDetail.aiAssessedTooltip` | This grade is generated by our AI model based on visual quality features. It serves as an objective market benchmark. | পণ্যের বাহ্যিক গুণাবলীর ওপর ভিত্তি করে এআই মডেল দ্বারা এই গ্রেড নির্ধারিত হয়েছে। এটি একটি নিরপেক্ষ মানদণ্ড হিসেবে কাজ করে। |
| `listingDetail.confidenceHigh` | High confidence | উচ্চ আত্মবিশ্বাস |
| `listingDetail.confidenceMedium` | Medium confidence | মাঝারি আত্মবিশ্বাস |
| `listingDetail.confidenceLow` | Low confidence | কম আত্মবিশ্বাস |
| `listingDetail.reasonsTitle` | Quality Observations | গুণমান পর্যবেক্ষণ |
| `listingDetail.degradedMode` | AI model running in offline mode | এআই অফলাইন মোডে চলছে |
| `listingDetail.marketRangeTitle` | AI Market Price Guidance | এআই বাজারদর নির্দেশিকা |
| `listingDetail.marketRangeLow` | Low | সর্বনিম্ন |
| `listingDetail.marketRangeExpected` | Expected | প্রত্যাশিত |
| `listingDetail.marketRangeHigh` | High | সর্বোচ্চ |
| `listingDetail.marketRangeCurrent` | Current bid | বর্তমান দর |
| `listingDetail.marketRangeFloor` | Opening floor | শুরুর দর |
| `listingDetail.positionBelow` | Below market range (great value) | বাজারদরের নিচে (সুলভ মূল্য) |
| `listingDetail.positionWithin` | Within expected market range | প্রত্যাশিত বাজারদরের মধ্যে |
| `listingDetail.positionAbove` | Above expected market range | বাজারদরের উপরে |
| `listingDetail.trendRising` | Rising trend | ঊর্ধ্বমুখী ট্রেন্ড |
| `listingDetail.trendStable` | Stable trend | স্থিতিশীল ট্রেন্ড |
| `listingDetail.trendFalling` | Falling trend | নিম্নমুখী ট্রেন্ড |
| `listingDetail.detailsTitle` | Produce Details | ফসলের বিবরণ |
| `listingDetail.lotQuantity` | Lot Quantity | লটের পরিমাণ |
| `listingDetail.farmerRegion` | Farmer Region | কৃষকের এলাকা |
| `listingDetail.openingFloor` | Opening Floor Price | শুরুর সর্বনিম্ন দর |
| `listingDetail.currentHighestBid` | Current Highest Bid | বর্তমান সর্বোচ্চ দর |
| `listingDetail.minIncrement` | Minimum Increment | সর্বনিম্ন বৃদ্ধির ধাপ |
| `listingDetail.timeRemaining` | Time remaining | বাকি সময় |
| `listingDetail.bidsCount` | {{count}} bids | {{count}}টি বিড |
| `listingDetail.bidHistoryTitle` | Bid History | বিডের ইতিহাস |
| `listingDetail.bidHistorySubtitle` | All bids are anonymized for fairness. | স্বচ্ছতার স্বার্থে সকল বিডকারীর পরিচয় গোপন রাখা হয়েছে। |
| `listingDetail.noBidsYet` | No bids have been placed yet. Be the first to bid! | এখনো কোনো বিড জমা পড়েনি। প্রথম বিডটি দিন! |
| `listingDetail.youBadge` | You | আপনি |
| `listingDetail.results.title` | Auction Result | নিলামের ফলাফল |
| `listingDetail.results.wonTitle` | You won this auction! | আপনি এই নিলামে বিজয়ী হয়েছেন! |
| `listingDetail.results.wonSubtitle` | Congratulations! An order has been created for your purchase. | অভিনন্দন! আপনার ক্রয়ের জন্য একটি অর্ডার তৈরি করা হয়েছে। |
| `listingDetail.results.viewOrder` | View Order | অর্ডার দেখুন |
| `listingDetail.results.soldTitle` | Auction Ended — Sold | নিলাম সমাপ্ত — বিক্রি হয়েছে |
| `listingDetail.results.soldSubtitle` | This lot was won by another buyer. | অন্য একজন ক্রেতা এই লটটি কিনেছেন। |
| `listingDetail.results.winningPrice` | Winning Price: | বিজয়ী দর: |
| `listingDetail.results.totalAmount` | Total Value: | মোট মূল্য: |
| `listingDetail.results.unsoldTitle` | Auction Ended — Unsold | নিলাম সমাপ্ত — বিক্রি হয়নি |
| `listingDetail.results.unsoldSubtitle` | No qualifying bids met the farmer's floor price. | কোনো বিডই কৃষকের সর্বনিম্ন দর স্পর্শ করেনি। |
| `listingDetail.results.cancelledTitle` | Auction Cancelled | নিলাম বাতিল |
| `listingDetail.results.cancelledSubtitle` | The farmer cancelled this listing. | কৃষক এই নিলামটি বাতিল করেছেন। |
| `listingDetail.stickyBidBar.bidNow` | Place Bid | বিড করুন |
| `listingDetail.stickyBidBar.auctionEnded` | Auction Ended | নিলাম শেষ |
| `compare.title` | Compare Produce | ফসলের তুলনা |
| `compare.subtitle` | Compare quality, prices, and auction end times side by side. | মান, দর এবং নিলামের সময় পাশাপাশি তুলনা করুন। |
| `compare.emptyTitle` | Your compare tray is empty | আপনার তুলনার তালিকা খালি |
| `compare.emptySubtitle` | Add produce listings from the marketplace to compare them side by side. | পাশাপাশি তুলনা করতে বাজার থেকে ফসলের তালিকা যোগ করুন। |
| `compare.goToMarketplace` | Explore Marketplace | বাজার দেখুন |
| `compare.minItemsNotice` | Select at least 2 listings to compare ({{count}} of 4 selected). | তুলনা করতে কমপক্ষে ২টি তালিকা বাছুন (৪টির মধ্যে {{count}}টি নির্বাচিত)। |
| `compare.minItemsTitle` | Select at least 2 listings to compare | তুলনা করতে কমপক্ষে ২টি তালিকা বাছুন |
| `compare.missingNotice` | Some listings in your compare tray are no longer available. | আপনার তুলনার তালিকার কিছু ফসল আর উপলব্ধ নেই। |
| `compare.removeUnavailable` | Remove unavailable | অনুপলব্ধগুলো সরান |
| `compare.mixedCropsError` | All listings in compare must belong to the same crop. | তুলনা করার সব ফসল একই জাতের হতে হবে। |
| `compare.best` | Best | সেরা |
| `compare.lowestPrice` | Lowest price | সর্বনিম্ন দর |
| `compare.bestGrade` | Best grade | সেরা মান |
| `compare.largestQuantity` | Largest quantity | সর্বোচ্চ পরিমাণ |
| `compare.bestValue` | Best value | সেরা মূল্য |
| `compare.bidNow` | Bid now | এখনই দর দিন |
| `compare.remove` | Remove | সরান |
| `compare.auctionEnded` | Auction ended | নিলাম শেষ |
| `compare.unavailable` | Unavailable | অনুপলব্ধ |
| `compare.listingUnavailable` | Listing unavailable | তালিকা পাওয়া যায়নি |
| `compare.rowAttributes` | Attribute | বৈশিষ্ট্য |
| `compare.rowPhoto` | Photo | ছবি |
| `compare.rowCrop` | Crop | ফসল |
| `compare.rowGrade` | Quality Grade | গুণমান |
| `compare.rowQuantity` | Quantity | পরিমাণ |
| `compare.rowPricePerKg` | Price per kg | প্রতি কেজি দর |
| `compare.rowTotalCost` | Total Cost | মোট খরচ |
| `compare.rowVsAi` | vs AI Market (%) | এআই বাজারদরের সাথে (%) |
| `compare.rowRegion` | Region | অঞ্চল |
| `compare.rowTimeLeft` | Time Left | বাকি সময় |
| `compare.rowActions` | Actions | পদক্ষেপ |

---

## 8. Dashboards & Analytics (ড্যাশবোর্ড, বিক্রয় ও বাজারদর অ্যানালিটিক্স) (246 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `sales.pageTitle` | Completed Sales | সম্পন্ন বিক্রয় |
| `sales.pageSubtitle` | Track your completed auction sales, filter by crop, date, or buyer region, and audit net payouts. | আপনার সম্পন্ন নিলাম বিক্রয়, ফসল, তারিখ বা ক্রেতার বিভাগ অনুযায়ী ফিল্টার করুন এবং নিট আয় হিসাব করুন। |
| `sales.filterCrop` | Crop | ফসল |
| `sales.allCrops` | All crops | সকল ফসল |
| `sales.filterDivision` | Buyer Division | ক্রেতার বিভাগ |
| `sales.allDivisions` | All divisions | সকল বিভাগ |
| `sales.startDate` | Start date | শুরুর তারিখ |
| `sales.endDate` | End date | শেষের তারিখ |
| `sales.clearFilters` | Clear filters | ফিল্টার মুছুন |
| `sales.tableCaption` | Completed auction sales and net payouts | সম্পন্ন নিলাম বিক্রয় এবং নিট মূল্য |
| `sales.date` | Date | তারিখ |
| `sales.crop` | Crop | ফসল |
| `sales.grade` | Grade | গ্রেড |
| `sales.quantity` | Quantity | পরিমাণ |
| `sales.pricePerKg` | Price/kg | দর/কেজি |
| `sales.gross` | Gross | মোট মূল্য |
| `sales.fee` | Platform fee | প্ল্যাটফর্ম ফি |
| `sales.net` | Farmer net | কৃষকের নিট আয় |
| `sales.buyer` | Buyer | ক্রেতা |
| `sales.region` | Division | বিভাগ |
| `sales.premium` | AI Premium | এআই প্রিমিয়াম |
| `sales.totalsRow` | Total (Filtered) | সর্বমোট (ফিল্টারকৃত) |
| `sales.page` | Page {{page}} of {{totalPages}} | পৃষ্ঠা {{page}} / {{totalPages}} |
| `sales.previous` | Previous | পূর্ববর্তী |
| `sales.next` | Next | পরবর্তী |
| `sales.emptyTitle` | No sales found | কোনো বিক্রয় তথ্য পাওয়া যায়নি |
| `sales.emptyFilteredSubtitle` | Try adjusting or clearing your filters to see more completed sales. | ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন। |
| `sales.emptySubtitle` | You haven't completed any sales yet. Completed auction orders will appear here. | আপনার এখনও কোনো বিক্রয় সম্পন্ন হয়নি। সম্পন্ন অর্ডারসমূহ এখানে প্রদর্শিত হবে। |
| `sales.newListing` | Create Listing | নতুন তালিকা তৈরি করুন |
| `sales.loadError` | Failed to load sales history. Check your connection and try again. | বিক্রয় তথ্য লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন। |
| `sales.retry` | Try again | পুনরায় চেষ্টা করুন |
| `sales.viewOrders` | View orders | অর্ডার দেখুন |
| `earnings.pageTitle` | Farmer Earnings | কৃষকের আয় |
| `earnings.pageSubtitle` | Your earnings overview, per-crop breakdown, 6-month earnings trend, and AI premium performance. | আপনার আয়ের সারসংক্ষেপ, ফসলভিত্তিক বিবরণ, ৬ মাসের আয়ের চিত্র এবং এআই মূল্যের প্রিমিয়াম। |
| `earnings.settledNet` | Settled (simulated) | পরিশোধিত (সিমুলেটেড) |
| `earnings.settledNetSubtitle` | Net payout from completed orders | সম্পন্ন অর্ডার থেকে প্রাপ্ত নিট আয় |
| `earnings.expectedNet` | Expected Net | প্রত্যাশিত আয় |
| `earnings.expectedNetSubtitle` | Active orders pending completion | চলমান অর্ডারের সম্ভাব্য আয় |
| `earnings.disputedNet` | In Dispute | বিরোধে আটকানো |
| `earnings.disputedNetSubtitle` | Held pending dispute resolution | মীমাংসা না হওয়া পর্যন্ত স্থগিত |
| `earnings.gross` | Gross Sales | মোট বিক্রয় |
| `earnings.grossSubtitle` | Total order value before fees | ফি কাটার পূর্বে মোট মূল্য |
| `earnings.fees` | Platform Fees | প্ল্যাটফর্ম ফি |
| `earnings.feesSubtitle` | Calculated on completed orders | সম্পন্ন অর্ডারে নির্ধারিত ফি |
| `earnings.pitchCardTitle` | Average Premium Over AI Market Estimate | এআই বাজারদরের চেয়ে গড় প্রিমিয়াম |
| `earnings.pitchCardSubtitle` | BazarBeat auctions delivered higher earnings compared to baseline AI local market price estimates. | স্থানীয় এআই প্রাক্কলিত মূল্যের তুলনায় বাজারবিট নিলামে প্রাপ্ত অতিরিক্ত গড় আয়। |
| `earnings.pitchBadge` | Auction Premium | নিলামের প্রিমিয়াম |
| `earnings.feeRateNote` | Current platform fee rate: {{percent}}% ({{bps}} bps) deducted only upon successful order completion. No upfront listing fees. | বর্তমান প্ল্যাটফর্ম ফি: {{percent}}% ({{bps}} bps), যা শুধুমাত্র সফল বিক্রয় সম্পন্ন হওয়ার পর কাটা হয়। অগ্রিম কোনো ফি নেই। |
| `earnings.sixMonthTrend` | 6-Month Earnings Trend | ৬ মাসের আয়ের ধারা |
| `earnings.sixMonthSubtitle` | Monthly net payouts in Asia/Dhaka time | এশিয়া/ঢাকা সময়ে মাসিক নিট আয় |
| `earnings.byCropTitle` | Earnings by Crop | ফসল অনুযায়ী আয় |
| `earnings.crop` | Crop | ফসল |
| `earnings.totalKg` | Total Volume | মোট পরিমাণ |
| `earnings.totalEarnings` | Net Earnings | নিট আয় |
| `earnings.avgPrice` | Avg. Price/kg | গড় দর/কেজি |
| `earnings.orderCount` | Orders | অর্ডার সংখ্যা |
| `earnings.avgPremium` | Avg. AI Premium | গড় এআই প্রিমিয়াম |
| `earnings.emptyTitle` | No earnings recorded yet | এখনও কোনো আয়ের রেকর্ড নেই |
| `earnings.emptySubtitle` | Publish produce auctions and fulfill completed orders to see your simulated earnings and analytics. | নিলাম শুরু করুন এবং সম্পন্ন অর্ডারের মাধ্যমে আপনার আয় ও পরিসংখ্যান দেখুন। |
| `earnings.newListing` | Create Listing | নতুন তালিকা তৈরি করুন |
| `earnings.loadError` | Failed to load earnings summary. Check your connection and try again. | আয়ের তথ্য লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন। |
| `earnings.retry` | Try again | পুনরায় চেষ্টা করুন |
| `earnings.na` | N/A | প্রযোজ্য নয় |
| `farmerDashboard.pageTitle` | Farmer Dashboard | কৃষক ড্যাশবোর্ড |
| `farmerDashboard.pageSubtitle` | Real-time overview of your sales, active auctions, and pending orders. | আপনার বিক্রয়, চলমান নিলাম এবং অপেক্ষমাণ অর্ডারের রিয়েল-টাইম তথ্য। |
| `farmerDashboard.newListing` | New Listing | নতুন তালিকা |
| `farmerDashboard.range.7d` | Last 7 days | গত ৭ দিন |
| `farmerDashboard.range.30d` | Last 30 days | গত ৩০ দিন |
| `farmerDashboard.range.90d` | Last 90 days | গত ৯০ দিন |
| `farmerDashboard.range.1y` | Last 1 year | গত ১ বছর |
| `farmerDashboard.range.all` | All time | সর্বমোট |
| `farmerDashboard.lastNDaysGroup` | Performance ({{range}}) | কর্মক্ষমতা ({{range}}) |
| `farmerDashboard.rightNowGroup` | Right Now | এখনই করণীয় |
| `farmerDashboard.totalSales` | Total Sales | মোট বিক্রয় |
| `farmerDashboard.totalSalesSubtitle` | Gross value from booked orders | সম্পন্ন অর্ডার থেকে মোট মূল্য |
| `farmerDashboard.earnings` | Net Earnings | নিট আয় |
| `farmerDashboard.earningsSubtitle` | Your payout after 2% platform fee | ২% প্ল্যাটফর্ম ফি কাটার পর আপনার আয় |
| `farmerDashboard.orders` | Orders Completed | অর্ডার সংখ্যা |
| `farmerDashboard.ordersSubtitle` | Orders placed in this period | এই সময়ে গৃহীত মোট অর্ডার |
| `farmerDashboard.winRate` | Win Rate | জয়ের হার (বিক্রয় হার) |
| `farmerDashboard.winRateSubtitle` | Auctions sold vs total closed | মোট নিলামের মধ্যে বিক্রিত নিলামের হার |
| `farmerDashboard.pricePremium` | Average price vs AI market estimate | এআই বাজারদরের চেয়ে গড় প্রিমিয়াম |
| `farmerDashboard.pricePremiumSubtitle` | Earnings gained above local baseline price | স্থানীয় বাজারদরের তুলনায় অতিরিক্ত আয় |
| `farmerDashboard.topCrop` | Top Crop | সেরা ফসল |
| `farmerDashboard.noTopCrop` | No sales yet | এখনও বিক্রয় হয়নি |
| `farmerDashboard.activeAuctions` | Active Auctions | চলমান নিলাম |
| `farmerDashboard.ordersNeedingAction` | Orders Needing Action | অপেক্ষমাণ অর্ডার |
| `farmerDashboard.produceListed` | Produce Listed | নিলামে মোট ফসল |
| `farmerDashboard.nearestDeadline` | Nearest Deadline | নিকটবর্তী সময়সীমা |
| `farmerDashboard.endingSoonTitle` | Auctions Ending Soon | শীঘ্রই শেষ হতে যাওয়া নিলাম |
| `farmerDashboard.viewAllBidding` | View in Crop Bidding | ফসলের দর পাতায় দেখুন |
| `farmerDashboard.noEndingSoon` | No auctions ending soon | শীঘ্রই শেষ হওয়ার মতো কোনো নিলাম নেই |
| `farmerDashboard.ordersCardTitle` | Orders Needing Confirmation | অর্ডার নিশ্চিতকরণ প্রয়োজন |
| `farmerDashboard.ordersCardSubtitle` | Confirm orders before the auto-cancellation deadline | স্বয়ংক্রিয় বাতিলের আগে অর্ডার নিশ্চিত করুন |
| `farmerDashboard.manageOrders` | View Pending Orders | অপেক্ষমাণ অর্ডার দেখুন |
| `farmerDashboard.vsPreviousPeriod` | vs previous period | পূর্ববর্তী সময়ের তুলনায় |
| `farmerDashboard.up` | up | বৃদ্ধি |
| `farmerDashboard.down` | down | হ্রাস |
| `farmerDashboard.noPriorData` | No prior data | পূর্ববর্তী তথ্য নেই |
| `farmerDashboard.emptyTitle` | Welcome to BazarBeat! | বাজারবিটে স্বাগতম! |
| `farmerDashboard.emptySubtitle` | You haven't listed any produce yet. List your harvest with AI quality grading and guaranteed floor prices to start receiving competitive bids. | আপনি এখনও কোনো ফসল তালিকাভুক্ত করেননি। প্রতিযোগিতামূলক দর পেতে এআই মান যাচাই এবং নিশ্চিত ন্যূনতম দর সহ আপনার ফসল তালিকাভুক্ত করুন। |
| `farmerDashboard.emptyReassurance` | Zero risk: if your floor price is not met, you can still sell locally as before. | কোনো ঝুঁকি নেই: কাঙ্ক্ষিত দর না পেলে আপনি স্থানীয় বাজারে আগের মতোই বিক্রি করতে পারবেন। |
| `farmerDashboard.createFirstListing` | Create your first listing | প্রথম তালিকা তৈরি করুন |
| `farmerDashboard.loadError` | Failed to load dashboard data. Check your connection and try again. | ড্যাশবোর্ড তথ্য লোড করা যায়নি। সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন। |
| `farmerDashboard.retry` | Try again | পুনরায় চেষ্টা করুন |
| `farmerDashboard.bidsCount` | {{count}} bids | {{count}}টি দর |
| `farmerDashboard.currentPrice` | Current Price | বর্তমান দর |
| `farmerDashboard.floorPrice` | Floor Price | ন্যূনতম দর |
| `farmerDashboard.deadlineAlert` | Urgent: Auto-cancel in {{time}} | জরুরি: স্বয়ংক্রিয় বাতিল হবে {{time}} মধ্যে |
| `farmerDashboard.deadlineSoon` | Action needed soon | শীঘ্রই পদক্ষেপ প্রয়োজন |
| `farmerDashboard.salesTrendTitle` | Booked Sales Trend | বুকড বিক্রির ধারা |
| `farmerDashboard.salesTrendSubtitle` | Gross booked value from sales over time (Asia/Dhaka) | বিক্রিত নিলাম থেকে মোট বুকড মূল্য (এশিয়া/ঢাকা) |
| `farmerDashboard.earningsByCropTitle` | Booked Value by Crop | ফসল অনুযায়ী বুকড মূল্য |
| `farmerDashboard.earningsByCropSubtitle` | Gross value and volume breakdown by crop | ফসলভিত্তিক মোট মূল্য এবং পরিমাণের বিবরণ |
| `buyerDashboard.pageTitle` | Buyer Dashboard | ক্রেতা ড্যাশবোর্ড |
| `buyerDashboard.pageSubtitle` | Real-time overview of your purchases, active bids, and order progress. | আপনার ক্রয়, চলমান দর এবং অর্ডারের অগ্রগতির রিয়েল-টাইম তথ্য। |
| `buyerDashboard.exploreMarketplace` | Explore Marketplace | মার্কেটপ্লেস দেখুন |
| `buyerDashboard.range.7d` | Last 7 days | গত ৭ দিন |
| `buyerDashboard.range.30d` | Last 30 days | গত ৩০ দিন |
| `buyerDashboard.range.90d` | Last 90 days | গত ৯০ দিন |
| `buyerDashboard.range.1y` | Last 1 year | গত ১ বছর |
| `buyerDashboard.range.all` | All time | সর্বমোট |
| `buyerDashboard.lastNDaysGroup` | Performance ({{range}}) | কর্মক্ষমতা ({{range}}) |
| `buyerDashboard.rightNowGroup` | Right Now | এখনই করণীয় |
| `buyerDashboard.bookedSpend` | Booked Spend | মোট বুকিং ব্যয় |
| `buyerDashboard.bookedSpendSubtitle` | Total spend from won auctions and orders | গৃহীত নিলাম এবং অর্ডার বাবদ মোট ব্যয় |
| `buyerDashboard.kgPurchased` | Produce Purchased | ক্রয়কৃত মোট ফসল |
| `buyerDashboard.kgPurchasedSubtitle` | Total volume purchased in this period | এই সময়ে ক্রয়কৃত মোট ফসলের পরিমাণ |
| `buyerDashboard.winRate` | Win Rate | জয়ের হার |
| `buyerDashboard.winRateSubtitle` | Auctions won vs completed bids | সম্পূর্ণ হওয়া নিলামে আপনার জয়ের শতকরা হার |
| `buyerDashboard.savingsVsMarket` | Savings vs Market | বাজারদরের তুলনায় সাশ্রয় |
| `buyerDashboard.savingsVsMarketSubtitle` | Price advantage vs AI market benchmark | এআই স্থানীয় বাজারদরের তুলনায় আপনার সাশ্রয় |
| `buyerDashboard.orders` | Orders Completed | অর্ডার সংখ্যা |
| `buyerDashboard.ordersSubtitle` | Orders placed in this period | এই সময়ে গৃহীত মোট অর্ডার |
| `buyerDashboard.activeBids` | Active Bids | চলমান দর |
| `buyerDashboard.winningBids` | Winning | এগিয়ে আছেন |
| `buyerDashboard.outbidBids` | Outbid | পিছিয়ে পড়েছেন |
| `buyerDashboard.winningAndOutbid` | {{winning}} winning • {{outbid}} outbid | {{winning}}টি এগিয়ে • {{outbid}}টি পিছিয়ে |
| `buyerDashboard.ordersNeedingAction` | Orders Needing Action | পদক্ষেপ প্রয়োজন এমন অর্ডার |
| `buyerDashboard.nearestDeadline` | Nearest Deadline | নিকটবর্তী সময়সীমা |
| `buyerDashboard.bidsEndingSoonTitle` | Bids Ending Soon | শীঘ্রই শেষ হতে যাওয়া দর |
| `buyerDashboard.viewMyBids` | View in My Bids | আমার দর পাতায় দেখুন |
| `buyerDashboard.noActiveBids` | No active bids right now | বর্তমানে কোনো সক্রিয় দর নেই |
| `buyerDashboard.recentOrdersTitle` | Recent Orders | সাম্প্রতিক অর্ডার |
| `buyerDashboard.viewAllOrders` | View all orders | সকল অর্ডার দেখুন |
| `buyerDashboard.noRecentOrders` | No orders yet | এখনও কোনো অর্ডার নেই |
| `buyerDashboard.ordersCardTitle` | Orders Needing Action | পদক্ষেপ প্রয়োজন এমন অর্ডার |
| `buyerDashboard.ordersCardSubtitle` | Pay or confirm receipt before the deadline | সময়সীমার পূর্বে পেমেন্ট বা প্রাপ্তি নিশ্চিত করুন |
| `buyerDashboard.manageOrders` | View Orders | অর্ডার দেখুন |
| `buyerDashboard.vsPreviousPeriod` | vs previous period | পূর্ববর্তী সময়ের তুলনায় |
| `buyerDashboard.emptyTitle` | Welcome to BazarBeat Marketplace! | বাজারবিট মার্কেটপ্লেসে স্বাগতম! |
| `buyerDashboard.emptySubtitle` | You haven't placed any bids or made any purchases yet. Browse quality-graded produce from farmers across Bangladesh and place your first bid. | আপনি এখনও কোনো দর দেননি বা কোনো ফসল ক্রয় করেননি। দেশব্যাপী কৃষকদের মান-যাচাইকৃত ফসল দেখুন এবং আপনার প্রথম দর দিন। |
| `buyerDashboard.exploreCrops` | Browse Marketplace | মার্কেটপ্লেসে যান |
| `buyerDashboard.loadError` | Failed to load buyer dashboard data. Check your connection and try again. | ড্যাশবোর্ড তথ্য লোড করা যায়নি। সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন। |
| `buyerDashboard.retry` | Try again | পুনরায় চেষ্টা করুন |
| `buyerDashboard.bidsCount` | {{count}} bids | {{count}}টি দর |
| `buyerDashboard.myBid` | My Bid | আমার দর |
| `buyerDashboard.highestBid` | Highest Bid | সর্বোচ্চ দর |
| `buyerDashboard.statusWinning` | Winning | এগিয়ে আছেন |
| `buyerDashboard.statusOutbid` | Outbid | পিছিয়ে পড়েছেন |
| `buyerDashboard.deadlineSoon` | Action needed soon | শীঘ্রই পদক্ষেপ প্রয়োজন |
| `buyerDashboard.spendTrendTitle` | Spend Trend | ব্যয়ের ধারা |
| `buyerDashboard.spendTrendSubtitle` | Total spend on won produce over time (Asia/Dhaka) | জিতা নিলাম থেকে মোট ক্রয়ের ব্যয় (এশিয়া/ঢাকা) |
| `buyerDashboard.purchasesByCropTitle` | Purchases by Crop | ফসল অনুযায়ী কেনাকাটা |
| `buyerDashboard.purchasesByCropSubtitle` | Total spend and volume purchased by crop | ফসলভিত্তিক মোট ব্যয় এবং ক্রয়ের পরিমাণ |
| `charts.viewChart` | Chart | চার্ট |
| `charts.viewTable` | Table | সারণী |
| `charts.chartView` | Chart | চার্ট |
| `charts.tableView` | Table | তালিকা |
| `charts.toggleView` | Toggle chart or data table view | চার্ট বা ডেটা টেবিল ভিউ পরিবর্তন করুন |
| `charts.avgPrice` | Average Price (৳/kg) | গড় দর (৳/কেজি) |
| `charts.priceRange` | Min–Max Range | সর্বনিম্ন–সর্বোচ্চ সীমা |
| `charts.emptyPriceHistory` | No price history available for the selected period. | নির্বাচিত সময়ের জন্য কোনো মূল্যের তথ্য পাওয়া যায়নি। |
| `charts.accessibleSummary` | Accessible text summary | অ্যাক্সেসযোগ্য টেক্সট সারাংশ |
| `charts.date` | Date | তারিখ |
| `charts.crop` | Crop | ফসল |
| `charts.sales` | Sales | বিক্রি |
| `charts.spend` | Spend | ব্যয় |
| `charts.value` | Value | মূল্য |
| `charts.quantity` | Volume (kg) | পরিমাণ (কেজি) |
| `charts.orders` | Orders | অর্ডার |
| `charts.total` | Total | মোট |
| `charts.emptyTrend` | No sales recorded in this period. | এই সময়কালে কোনো বিক্রি বা কার্যক্রম রেকর্ড করা হয়নি। |
| `charts.emptySpendTrend` | No purchases or spend recorded in this period. | এই সময়কালে কোনো ক্রয় বা ব্যয় রেকর্ড করা হয়নি। |
| `charts.emptyCropBreakdown` | No crop sales recorded in this period. | এই সময়কালে কোনো ফসলের বিক্রি রেকর্ড করা হয়নি। |
| `charts.emptyBuyerCropBreakdown` | No crop purchases recorded in this period. | এই সময়কালে কোনো ফসলের কেনাকাটা রেকর্ড করা হয়নি। |
| `charts.trendSummary` | {{range}}: {{totalValue}} total across {{totalOrders}} orders ({{totalKg}} kg produce). | {{range}}: {{totalOrders}}টি অর্ডার থেকে {{totalValue}} ({{totalKg}} কেজি পণ্য)। |
| `charts.cropSummary` | {{crop}}: {{value}} ({{kg}} kg, {{orders}} orders). | {{crop}}: {{value}} ({{kg}} কেজি, {{orders}}টি অর্ডার)। |
| `marketPrices.title` | Market Prices | বাজারদর |
| `marketPrices.subtitle` | Track live produce prices, AI grade guidance, and regional price trends. | রিয়েল-টাইম বাজারদর, এআই গ্রেড নির্দেশিকা এবং আঞ্চলিক মূল্যের ধারা পর্যবেক্ষণ করুন। |
| `marketPrices.cropSelectorLabel` | Crop | ফসল |
| `marketPrices.divisionSelectorLabel` | Division | বিভাগ |
| `marketPrices.allDivisionsNational` | All Divisions (National Mean) | সকল বিভাগ (জাতীয় গড়) |
| `marketPrices.allDivisions` | All Divisions | সকল বিভাগ |
| `marketPrices.latestAverage` | Latest Average | সর্বশেষ গড় দর |
| `marketPrices.trend` | Market Trend | বাজারের ধারা |
| `marketPrices.sevenDayChange` | 7-Day Change | ৭ দিনের পরিবর্তন |
| `marketPrices.periodRange` | Period Range | সময়সীমার সীমা |
| `marketPrices.minMaxBand` | Min–Max Band | সর্বনিম্ন-সর্বোচ্চ সীমা |
| `marketPrices.trendUp` | Trending Up | ঊর্ধ্বমুখী |
| `marketPrices.trendDown` | Trending Down | নিম্নমুখী |
| `marketPrices.trendFlat` | Stable | স্থিতিশীল |
| `marketPrices.divisionVsNational` | Your Division vs. National | আপনার বিভাগ বনাম জাতীয় গড় |
| `marketPrices.divisionVsNationalSubtitle` | Comparison of current average price with nationwide average | জাতীয় গড় দরের তুলনায় আপনার বিভাগের বর্তমান গড় দরের তুলনা |
| `marketPrices.higherThanNational` | higher than national average | জাতীয় গড়ের চেয়ে বেশি |
| `marketPrices.lowerThanNational` | lower than national average | জাতীয় গড়ের চেয়ে কম |
| `marketPrices.sameAsNational` | equal to national average | জাতীয় গড়ের সমান |
| `marketPrices.gradeGuideTitle` | AI Grade Guide | এআই গ্রেড নির্দেশিকা |
| `marketPrices.gradeGuideSubtitle` | Expected prices for Grades A, B, and C benchmarked by AI | এআই দ্বারা গ্রেড এ, বি এবং সি-এর প্রত্যাশিত দর |
| `marketPrices.grade` | Grade | গ্রেড |
| `marketPrices.expectedPrice` | Expected | প্রত্যাশিত দর |
| `marketPrices.suggestedFloor` | Suggested Floor | প্রস্তাবিত শুরুর দর |
| `marketPrices.gradeRange` | Price Range | দরের সীমা |
| `marketPrices.createListingCta` | Create Listing for {{crop}} | {{crop}}-এর তালিকা তৈরি করুন |
| `marketPrices.todayMarketTitle` | Today's Market | আজকের বাজারদর |
| `marketPrices.todayMarketSubtitle` | Current market prices in {{division}} | {{division}} বিভাগে বর্তমান বাজারদর |
| `marketPrices.todayMarketNationalSubtitle` | Current nationwide market prices | দেশজুড়ে বর্তমান বাজারদর |
| `marketPrices.viewAllMarketPrices` | View all market prices → | সকল বাজারদর দেখুন → |
| `marketPrices.noActiveListings` | No active listings | কোনো সক্রিয় তালিকা নেই |
| `marketPrices.activeListingsCount` | {{count}} active listings | {{count}}টি সক্রিয় তালিকা |
| `marketPrices.lastUpdated` | Updated | হালনাগাদ |
| `marketPrices.emptyHistory` | No price history available for this selection. | এই নির্বাচনের জন্য কোনো বাজারদরের ইতিহাস পাওয়া যায়নি। |
| `marketPrices.loading` | Loading market data... | বাজারদর লোড হচ্ছে... |
| `marketPrices.error` | Could not load market data | বাজারদর লোড করা সম্ভব হয়নি |
| `marketPrices.retry` | Retry | পুনরায় চেষ্টা করুন |
| `marketOverview.title` | Market Overview | বাজারের সারাংশ |
| `marketOverview.subtitle` | Comprehensive national crop × division price matrix and active listing volume. | দেশব্যাপী সকল বিভাগে ফসলভিত্তিক দর এবং সক্রিয় তালিকার বিস্তারিত ম্যাট্রিক্স। |
| `marketOverview.heatTableTitle` | Crop × Division Price Heat Table | ফসল × বিভাগ মূল্যের হিট টেবিল |
| `marketOverview.heatTableSubtitle` | Prices displayed in ৳/kg. Cell heat scale indicates deviation from the national mean. | প্রতি কেজির দর ৳-তে প্রদর্শিত। সেলের রঙ জাতীয় গড়ের সাথে পার্থক্য নির্দেশ করে। |
| `marketOverview.cropColumn` | Crop | ফসল |
| `marketOverview.nationalMeanColumn` | National Mean | জাতীয় গড় |
| `marketOverview.legendTitle` | Heat Scale (vs National Mean) | হিট স্কেল (জাতীয় গড়ের তুলনায়) |
| `marketOverview.legendBelow` | Below Avg (-5% or more) | গড়ের নিচে (-৫% বা কম) |
| `marketOverview.legendNear` | Near Avg (±5%) | গড়ের কাছাকাছি (±৫%) |
| `marketOverview.legendAbove` | Above Avg (+5% or more) | গড়ের উপরে (+৫% বা বেশি) |
| `marketOverview.noListings` | — | — |
| `marketOverview.activeListings` | {{count}} listings | {{count}}টি তালিকা |
| `marketOverview.totalVolume` | {{kg}} kg | {{kg}} কেজি |
| `marketOverview.openMarketplace` | View active listings in Marketplace → | মার্কেটপ্লেসে সক্রিয় তালিকা দেখুন → |
| `marketOverview.nationalTrendTitle` | National Price Trend | জাতীয় মূল্যের ধারা |
| `marketOverview.nationalTrendSubtitle` | Historical average prices nationwide for {{crop}} | {{crop}}-এর জন্য দেশব্যাপী ঐতিহাসিক গড় দর |
| `marketOverview.selectCrop` | Select Crop | ফসল নির্বাচন করুন |
| `marketOverview.mobileScrollHint` | Scroll horizontally to view all divisions → | সকল বিভাগ দেখতে ডানে-বামে স্ক্রোল করুন → |
| `marketOverview.loading` | Loading national overview... | বাজারের সারাংশ লোড হচ্ছে... |
| `marketOverview.error` | Could not load market overview | বাজারের সারাংশ লোড করা সম্ভব হয়নি |
| `marketOverview.retry` | Retry | পুনরায় চেষ্টা করুন |

---

## 9. Inventory & Stock Ledger (ফসলের মজুত ও ইনভেন্টরি লেজার) (34 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `inventory.title` | Inventory | মজুত |
| `inventory.description` | Track available, listed, and sold crop stock. | উপলভ্য, তালিকাভুক্ত ও বিক্রি হওয়া ফসলের মজুত দেখুন। |
| `inventory.available` | Available | উপলভ্য |
| `inventory.listed` | Listed | তালিকাভুক্ত |
| `inventory.sold` | Sold | বিক্রি হয়েছে |
| `inventory.availableShort` | Available | উপলভ্য |
| `inventory.listedShort` | Listed | তালিকাভুক্ত |
| `inventory.soldShort` | Sold | বিক্রি |
| `inventory.addStock` | Add stock | মজুত যোগ করুন |
| `inventory.addTitle` | Add harvested stock | কাটা ফসলের মজুত যোগ করুন |
| `inventory.crop` | Crop | ফসল |
| `inventory.quantity` | Quantity | পরিমাণ |
| `inventory.kilograms` | Kilograms | কিলোগ্রাম |
| `inventory.noteOptional` | Note (optional) | নোট (ঐচ্ছিক) |
| `inventory.cancel` | Cancel | বাতিল |
| `inventory.saving` | Saving… | সংরক্ষণ হচ্ছে… |
| `inventory.validation` | Enter a valid crop and quantity up to 5,000 kg with at most one decimal place. | সঠিক ফসল ও ৫,০০০ কেজির মধ্যে সর্বোচ্চ এক দশমিকের পরিমাণ দিন। |
| `inventory.addError` | Stock could not be added. Please try again. | মজুত যোগ করা যায়নি। আবার চেষ্টা করুন। |
| `inventory.loadError` | Inventory could not be loaded. | মজুত লোড করা যায়নি। |
| `inventory.retry` | Try again | আবার চেষ্টা করুন |
| `inventory.noCrops` | No crops are available yet. | এখনো কোনো ফসল পাওয়া যায়নি। |
| `inventory.historyTitle` | Movement history | মজুতের ইতিহাস |
| `inventory.chooseHistoryCrop` | Choose a crop for movement history | ইতিহাসের জন্য ফসল বাছুন |
| `inventory.noMovements` | No movements for this crop yet. | এই ফসলের কোনো মজুত পরিবর্তন নেই। |
| `inventory.movement` | Movement | পরিবর্তন |
| `inventory.date` | Date | তারিখ |
| `inventory.previous` | Previous | আগের |
| `inventory.next` | Next | পরের |
| `inventory.page` | Page {{page}} of {{maxPage}} | পৃষ্ঠা {{page}} / {{maxPage}} |
| `inventory.types.ADD` | Stock added | মজুত যোগ |
| `inventory.types.LIST` | Listed for auction | নিলামে তালিকাভুক্ত |
| `inventory.types.RELEASE` | Stock released | মজুত ফেরত |
| `inventory.types.SELL` | Sold | বিক্রি |
| `inventory.types.ADJUST` | Stock adjusted | মজুত সমন্বয় |

---

## 10. Navigation, Auth & Common Elements (নেভিগেশন, লগইন ও সাধারণ উপাদান) (59 strings)

| Key | English Text | Bangla Translation (পর্যালোচনা ও অনুবাদ) |
|---|---|---|
| `appName` | BazarBeat | বাজারবিট |
| `tagline` | Better price. Stronger farmer. | ন্যায্য দাম, শক্তিশালী কৃষক |
| `introduction` | A fairer way for farmers and buyers to meet. | কৃষক ও ক্রেতাদের মিলিত হওয়ার আরও ন্যায্য উপায়। |
| `exploreMarketplace` | Explore marketplace | বাজার দেখুন |
| `marketplacePlaceholder` | Marketplace is getting ready. | বাজার প্রস্তুত করা হচ্ছে। |
| `language` | Language | ভাষা |
| `languageSaveFailed` | Language changed on this device, but your account preference could not be saved. | এই ডিভাইসে ভাষা বদলেছে, তবে অ্যাকাউন্টে পছন্দটি সংরক্ষণ করা যায়নি। |
| `english` | English | English |
| `bangla` | বাংলা | বাংলা |
| `navigation` | Main navigation | প্রধান নেভিগেশন |
| `roles.FARMER` | Farmer | কৃষক |
| `roles.BUYER` | Buyer | ক্রেতা |
| `nav.dashboard` | Dashboard | ড্যাশবোর্ড |
| `nav.products` | Products | পণ্য |
| `nav.myListings` | My Listings | আমার তালিকা |
| `nav.newListing` | New Listing | নতুন তালিকা |
| `nav.cropBidding` | Crop Bidding | ফসলের দর |
| `nav.inventory` | Inventory | মজুত |
| `nav.orders` | Orders | অর্ডার |
| `nav.sales` | Sales | বিক্রয় |
| `nav.earnings` | Earnings | আয় |
| `nav.marketPrices` | Market Prices | বাজারদর |
| `nav.settings` | Settings | সেটিংস |
| `nav.marketplace` | Marketplace | বাজার |
| `nav.compare` | Compare | তুলনা |
| `nav.myBids` | My Bids | আমার দর |
| `nav.watchlist` | Watchlist | পছন্দের তালিকা |
| `nav.marketOverview` | Market Overview | বাজারের সারাংশ |
| `nav.notifications` | Notifications | বিজ্ঞপ্তি |
| `form.name` | Full name | পুরো নাম |
| `form.phone` | Bangladesh mobile number | বাংলাদেশি মোবাইল নম্বর |
| `form.countryCode` | Country calling code | দেশের ফোন কোড |
| `form.bangladeshCode` | BD (+880) | বাংলাদেশ (+880) |
| `form.password` | Password | পাসওয়ার্ড |
| `form.division` | Division | বিভাগ |
| `form.district` | District | জেলা |
| `form.upazilaOptional` | Upazila (optional) | উপজেলা (ঐচ্ছিক) |
| `form.organizationOptional` | Organization (optional) | প্রতিষ্ঠান (ঐচ্ছিক) |
| `form.choose` | Choose one | একটি নির্বাচন করুন |
| `form.working` | Please wait… | অপেক্ষা করুন… |
| `login.title` | Log in | লগ ইন |
| `login.description` | Sign in to continue to your BazarBeat account. | আপনার বাজারবিট অ্যাকাউন্টে প্রবেশ করুন। |
| `login.submit` | Log in | লগ ইন |
| `login.noAccount` | New to BazarBeat? | বাজারবিটে নতুন? |
| `login.createAccount` | Create an account | অ্যাকাউন্ট তৈরি করুন |
| `login.registered` | Your account is ready. Log in to continue. | আপনার অ্যাকাউন্ট তৈরি হয়েছে। চালিয়ে যেতে লগ ইন করুন। |
| `register.title` | Create account | অ্যাকাউন্ট তৈরি করুন |
| `register.description` | Join BazarBeat as a farmer or buyer. | কৃষক বা ক্রেতা হিসেবে বাজারবিটে যোগ দিন। |
| `register.role` | I am joining as a | আমি যোগ দিচ্ছি |
| `register.submit` | Create account | অ্যাকাউন্ট তৈরি করুন |
| `register.passwordHint` | At least 8 characters. Common passwords such as 12345678 are not accepted. | কমপক্ষে ৮ অক্ষর দিন। 12345678-এর মতো সহজ পাসওয়ার্ড গ্রহণ করা হয় না। |
| `register.haveAccount` | Already have an account? | আগে থেকেই অ্যাকাউন্ট আছে? |
| `register.signIn` | Log in | লগ ইন |
| `auth.loading` | Checking your session… | আপনার সেশন যাচাই হচ্ছে… |
| `auth.loadError` | We could not connect to your account. Check your connection and try again. | অ্যাকাউন্টে সংযোগ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন। |
| `auth.retry` | Try again | আবার চেষ্টা করুন |
| `auth.logout` | Log out | লগ আউট |
| `auth.pagePlaceholder` | This page will be available in a later marketplace phase. | বাজারের পরবর্তী ধাপে এই পৃষ্ঠাটি চালু হবে। |
| `auth.logoutError` | We could not end your session. Check your connection and try again. | আপনার সেশন শেষ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন। |

---

## 11. Additional Strings (24 strings)

| Key | English Text | Bangla Translation |
|---|---|---|
| `landing.badge` | Digital Agricultural Marketplace | ডিজিটাল কৃষি মার্কেটপ্লেস |
| `landing.heading` | Better Price, Stronger Farmer | ন্যায্য দাম, শক্তিশালী কৃষক |
| `landing.subheading` | A transparent digital marketplace connecting Bangladeshi farmers and buyers with AI quality grading, floor price protection, and real-time competitive bidding. | এআই গুণমান যাচাই, ন্যূনতম দর সুরক্ষা এবং রিয়েল-টাইম প্রতিযোগিতামূলক নিলামের মাধ্যমে বাংলাদেশের কৃষক ও ক্রেতাদের নির্ভরযোগ্য সংযোগ। |
| `landing.farmerSectionTitle` | For Farmers | কৃষকদের জন্য |
| `landing.farmerSectionSubtitle` | Sell produce at fair market value with zero middlemen pressure. | মধ্যস্বত্বভোগীদের চাপমুক্ত হয়ে ন্যায্যমূল্যে নিজের ফসল বিক্রি করুন। |
| `landing.farmerStep1Title` | 1. AI Quality Grading | ১. এআই গুণমান যাচাই |
| `landing.farmerStep1Desc` | Upload produce photos for instant Grade A/B/C classification and benchmark mandi price guidance. | ফসলের ছবি আপলোড করে মুহূর্তেই গ্রেড ক/খ/গ ও পাইকারি বাজারদর নির্দেশিকা পান। |
| `landing.farmerStep2Title` | 2. Floor-Protected Bidding | ২. ন্যূনতম দর সুরক্ষা |
| `landing.farmerStep2Desc` | Set your minimum acceptable price per kg. Buyers compete upwards in timed auctions; your crop is never sold below floor. | নিজের ন্যূনতম দর নির্ধারণ করুন। ক্রেতারা ঊর্ধ্বমুখী ডাক দেন; নির্ধারিত দরের নিচে ফসল বিক্রি হবে না। |
| `landing.farmerStep3Title` | 3. Direct Handover & Payment | ৩. সরাসরি হস্তান্তর ও মূল্য প্রাপ্তি |
| `landing.farmerStep3Desc` | Confirm schedule, receive timely settlement, and keep higher margins on every harvest. | সময়সূচি নির্ধারণ করুন, সময়মতো নিশ্চিত মূল্য গ্রহণ করুন এবং ফসলের সঠিক লাভ ঘরে তুলুন। |
| `landing.farmerCta` | Start as Farmer | কৃষক হিসেবে শুরু করুন |
| `landing.buyerSectionTitle` | For Buyers | ক্রেতাদের জন্য |
| `landing.buyerSectionSubtitle` | Source verified quality crops directly from local farming communities. | সরাসরি কৃষকদের কাছ থেকে মানসম্মত ফসল পাইকারি দরে সংগ্রহ করুন। |
| `landing.buyerStep1Title` | 1. Verified Produce Catalog | ১. যাচাইকৃত ফসলের তালিকা |
| `landing.buyerStep1Desc` | Explore active lots across 5 core crops with transparent grading photos, location, and volume. | স্বচ্ছ ছবি, অবস্থান ও পরিমাণসহ ৫টি প্রধান ফসলের চলমান তালিকা দেখুন। |
| `landing.buyerStep2Title` | 2. Fair Ascending Bids | ২. উন্মুক্ত প্রতিযোগিতামূলক ডাক |
| `landing.buyerStep2Desc` | Place binding bids with clear minimum increments and live countdowns. Win lots fairly and transparently. | নির্দিষ্ট নিয়ম মেনে সরাসরি ডাক দিন ও সময় গণনার সাথে স্বচ্ছভাবে নিলামে অংশগ্রহণ করুন। |
| `landing.buyerStep3Title` | 3. Guaranteed Settlement | ৩. নিশ্চিত ডেলিভারি ও নিষ্পত্তি |
| `landing.buyerStep3Desc` | Track order status, schedule pickup, and receive verified produce with problem resolution support. | অর্ডারের ধাপ ট্র্যাক করুন, পণ্য বুঝে নিন এবং নির্ভরযোগ্য সহায়তার সুবিধা পান। |
| `landing.buyerCta` | Explore as Buyer | ক্রেতা হিসেবে শুরু করুন |
| `landing.browseMarketCTA` | Browse Marketplace | মার্কেটপ্লেস দেখুন |
| `landing.loginPrompt` | Already have an account? | ইতিমধ্যে অ্যাকাউন্ট আছে? |
| `landing.loginLink` | Log In | লগ ইন করুন |

---

