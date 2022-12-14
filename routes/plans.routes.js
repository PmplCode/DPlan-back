const express = require("express");
const User = require("../models/User.model");
const Plan = require("../models/Plan.model");
const router = express.Router();

// ********* require fileUploader in order to use it *********
const fileUploader = require("../config/cloudinary.config");
const { default: mongoose } = require("mongoose");

var ObjectID = require("mongodb").ObjectId;

router.get("/", (req, res, next) => {
  res.json("jaja");
});

router.get("/plans", (req, res, next) => {
  Plan.find({ privacy: "public" })
    .then((response) => {
      res.json(response);
    })
    .catch((error) => {
      res.json(error);
    });
});

// Create new plan --> /api/plans/:username/newPlan
router.post(
  "/:username/newPlan",
  fileUploader.single("planImage"),
  (req, res, next) => {
    let username = req.params.username;
    // const { title, description, image, date, time, location, tags } = req.body;
    const {
      title,
      description,
      planImage,
      date,
      time,
      location,
      latitud,
      longitud,
      musicList,
      photoCloud,
      interestingLinks,
      privacy,
    } = req.body;

    if (
      title === "" ||
      description === "" ||
      date === "" ||
      time === "" ||
      location === ""
    ) {
      res.status(400).json({ message: "Please fill in all fields" });
      return;
    }
    const promNewPlan = Plan.create({
      title,
      description,
      planImage: req.file.path,
      date,
      time,
      location,
      latitud,
      longitud,
      isAdmin: username,
      musicList,
      photoCloud,
      interestingLinks,
      privacy,
    });
    const promUser = User.findOne({ username: username });
    Promise.all([promNewPlan, promUser]).then((resp) => {
      resp[1].plans.push({ _id: resp[0]._id.toString(), status: "admin" });
      User.findByIdAndUpdate(resp[1]._id, resp[1], { new: true })
        .then((resp) => {
          res.json(resp);
        })
        .catch((error) => {
          res.json(error);
        });
    });
    // res.json(req.body);
  }
);

// Plan Page --> /api/plans/:planId
router.get("/:planId", (req, res, next) => {
  Plan.findOne({ _id: req.params.planId })
    .then((result) => {
      res.json(result);
    })
    .catch((error) => res.json(error));
});

// Plan Edit --> /api/plans/:planId
router.put("/:planId", fileUploader.single("planImage"), (req, res, next) => {
  const {
    title,
    description,
    date,
    time,
    location,
    musicList,
    photoCloud,
    interestingLinks,
  } = req.body;
  if (
    title === "" ||
    description === "" ||
    date === "" ||
    time === "" ||
    location === ""
  ) {
    res.status(400).json({ message: "Please fill in all fields" });
    return;
  }
  Plan.findByIdAndUpdate(
    req.params.planId,
    req.file ? { planImage: req.file.path } : req.body,
    { new: true }
  )
    .then((result) => {
      res.json(result);
    })
    .catch((error) => res.json(error));
});

// Plan Delete --> /api/plans/:planId
router.delete("/:planId", (req, res, next) => {
  //It would be a nice idea to update the plans array accessing through the planId populate
  User.updateMany({}, { $pull: { plans: { _id: req.params.planId } } })
    .then((result) => {})
    .catch((error) => res.json(error));

  Plan.findByIdAndDelete(req.params.planId)
    .then((result) => {
      res.json("Plan deleted succesfully!");
    })
    .catch((error) => res.json(error));
});

// Plan Guests --> /api/plans/:planId/guests
router.get("/:planId/guests", (req, res, next) => {
  Plan.findById(req.params.planId)
    .populate("invited")
    .populate("accepted")
    .populate("declined")
    .then((result) => {
      res.json(result);
    })
    .catch((error) => res.json(error));
});

//ADD POLL TO THE PLAN: /api/plans/:planId/addPoll
router.post("/:planId/addPoll", (req, res, next) => {

  Plan.findByIdAndUpdate(
    req.params.planId,
    { $addToSet: { polls: req.body } },
    { new: true }
  )
    .then((resp) => {
      res.json(resp);
    })
    .catch((error) => res.json(error));
});

//ADD VOTE TO THE PLAN:
router.post("/:planId/addVote", (req, res, next) => {
  Plan.findById(req.params.planId)
    .then((resp) => {
      resp.polls.forEach((poll) => {
        if (
          poll.pollAnswers.some((ans) =>
            ans._id.toString().includes(req.body._id)
          )
        ) {
          const index = poll.pollAnswers
            .map((e) => e._id.toString())
            .indexOf(req.body._id.toString());
          poll.pollAnswers[index].votes++;
        }
      });

      Plan.findByIdAndUpdate(req.params.planId, resp, { new: true }).then(
        (response) => {
          res.json(response);
        }
      );
    })
    .catch((error) => res.json(error));
});

// Invite guests to a plan (list of friends) --> /api/plans/:planId/:username/invite
router.get("/:planId/:username/invite", (req, res, next) => {
  let username = req.params.username;
  User.findOne({ username: username })
    .populate("friends")
    .then((result) => {
      res.json(result);
    })
    .catch((error) => res.json(error));
});

// Invite guests to a plan (invite) --> /api/plans/:planId/:idPerson/invite
router.post("/:planId/:idPerson/invite", (req, res, next) => {
  let idPerson = req.params.idPerson;
  let planId = req.params.planId;
  let promUser = User.findById(idPerson);
  let promPlan = Plan.findById(planId);
  Promise.all([promUser, promPlan])
    .then((resp) => {
      resp[0].plans.push({ _id: planId, status: "pending" });
      resp[1].invited.push(idPerson);
      let promUserUpdated = User.findByIdAndUpdate(idPerson, resp[0], {
        new: true,
      });
      let promPlanUpdated = Plan.findByIdAndUpdate(planId, resp[1], {
        new: true,
      });
      return Promise.all([promUserUpdated, promPlanUpdated]);
    })
    .then((resp) => {
      res.json(resp);
    })
    .catch((error) => res.json(error));
});

// Accept Plan --> /api/plans/:planId/:username/accept
router.post("/:planId/:username/accept", (req, res, next) => {
  const promUser = User.findOne({ username: req.params.username });
  const promPlan = Plan.findById(req.params.planId);

  Promise.all([promUser, promPlan])
    .then((resp) => {
      if (resp[1].privacy === "public") {
        const promUserPublic = User.findByIdAndUpdate(
          resp[0]._id,
          { $push: { plans: { _id: resp[1], status: "confirmed" } } },
          { new: true }
        );
        const promPlanPublicAccept = Plan.findByIdAndUpdate(
          resp[1]._id,
          { $push: { accepted: resp[0]._id } },
          { new: true }
        );
        const promPlanPublicInvite = Plan.findByIdAndUpdate(
          resp[1]._id,
          { $pull: { invited: resp[0]._id } },
          { new: true }
        );

        Promise.all([
          promUserPublic,
          promPlanPublicAccept,
          promPlanPublicInvite,
        ])
          .then((response) => {
            res.json(response[0]);
          })
          .catch((error) => res.json(error));
      } else {
        const plansUpdated = resp[0].plans.map((plan) => {
          if (plan._id.toString() == req.params.planId) {
            plan.status = "confirmed";
          }
          return plan;
        });

        let indexUser = resp[1].invited.indexOf(resp[0]._id);
        resp[1].invited.splice(indexUser, 1);
        resp[1].accepted.push(resp[0]._id);

        const promUser2 = User.findByIdAndUpdate(
          resp[0]._id,
          { plans: plansUpdated },
          { new: true }
        );
        const promPlan2 = Plan.findByIdAndUpdate(req.params.planId, resp[1], {
          new: true,
        });
        return Promise.all([promUser2, promPlan2]);
      }
    })
    .then((resp) => {
      // res.json(resp);  //descomenta esto si es necesario siino da problemas para confirmar public plans
    })
    .catch((error) => res.json(error));
});

// Decline Plan --> /api/plans/:planId/:username/decline
router.post("/:planId/:username/decline", (req, res, next) => {
  const promUser = User.findOne({ username: req.params.username });
  const promPlan = Plan.findById(req.params.planId);

  Promise.all([promUser, promPlan])
    .then((resp) => {
      if (resp[1].privacy === "public") {
        const promUserPublic = User.findByIdAndUpdate(
          resp[0]._id,
          { $push: { plans: { _id: resp[1], status: "declined" } } },
          { new: true }
        );
        const promPlanPublicDecline = Plan.findByIdAndUpdate(
          resp[1]._id,
          { $push: { declined: resp[0]._id } },
          { new: true }
        );
        // const promPlanPublicInvite = Plan.findByIdAndUpdate(resp[1]._id, { "$pull": { "invited":  resp[0]._id}}, {new: true});

        Promise.all([promUserPublic, promPlanPublicDecline])
          .then((response) => {
            // res.json(response[0])
            // res.json(response[1])
          })
          .catch((error) => res.json(error));
      } else {
        const plansUpdated = resp[0].plans.map((plan) => {
          if (plan._id.toString() == req.params.planId) {
            plan.status = "declined";
          }
          return plan;
        });

        let indexUser = resp[1].invited.indexOf(resp[0]._id);
        resp[1].invited.splice(indexUser, 1);
        resp[1].declined.push(resp[0]._id);

        const promUser2 = User.findByIdAndUpdate(
          resp[0]._id,
          { plans: plansUpdated },
          { new: true }
        );
        const promPlan2 = Plan.findByIdAndUpdate(req.params.planId, resp[1], {
          new: true,
        });
        return Promise.all([promUser2, promPlan2]);
      }
    })
    .then((resp) => {
      res.json(resp);
    })
    .catch((error) => res.json(error));
});

module.exports = router;
